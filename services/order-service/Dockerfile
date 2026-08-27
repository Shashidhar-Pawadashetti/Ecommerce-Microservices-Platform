# ══════════════════════════════════════════════════════════════════════
#  order-service — multi-stage build (clone of auth-service template)
#
#  build:   eclipse-temurin:21-jdk-alpine   (compile, release-21 bytecode)
#  runtime: eclipse-temurin:21-jre-alpine   (JRE only, non-root user spring)
#
#  Memory posture D-03: MaxRAMPercentage=75 here pairs with mem_limit on the
#  compose entry. Healthchecks must use BusyBox wget — alpine ships no curl.
#  Base images pinned by docs/versions.md; do not substitute tags.
# ══════════════════════════════════════════════════════════════════════

# ---- build stage: full JDK ----
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /workspace
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
# Best-effort dependency layer cache: tolerate offline quirks, never fail the build.
RUN ./mvnw -q -B dependency:go-offline || true
COPY src ./src
RUN ./mvnw -q -B package -DskipTests

# ---- runtime stage: JRE only, non-root ----
FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S spring && adduser -S spring -G spring
USER spring
WORKDIR /app
COPY --from=build /workspace/target/*.jar app.jar
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
EXPOSE 8082
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
