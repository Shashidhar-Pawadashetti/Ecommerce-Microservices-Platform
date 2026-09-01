import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Forward to the API Gateway's authentication endpoint
    const response = await fetch("http://api-gateway:8080/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Authentication failed" }, { status: response.status });
    }

    const data = await response.json();
    const token = data.token || data.accessToken;

    if (!token) {
      return NextResponse.json({ error: "Invalid response from authentication server" }, { status: 500 });
    }

    // Create the response and set the httpOnly cookie
    const nextResponse = NextResponse.json({ success: true });
    
    nextResponse.cookies.set({
      name: "auth_token",
      value: token,
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 3600 // 1 hour
    });

    return nextResponse;
  } catch (error) {
    console.error("Login route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
