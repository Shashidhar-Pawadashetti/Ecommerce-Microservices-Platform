import pytest
import pytest_asyncio
from testcontainers.community.redis import RedisContainer
from redis.asyncio import Redis


@pytest.fixture(scope="session")
def redis_container():
    with RedisContainer("redis:8-alpine") as container:
        yield container


@pytest_asyncio.fixture
async def redis_client(redis_container):
    host = redis_container.get_container_host_ip()
    port = redis_container.get_exposed_port(6379)
    url = f"redis://{host}:{port}"
    client = Redis.from_url(url, decode_responses=False)
    yield client
    await client.flushall()
    await client.aclose()
