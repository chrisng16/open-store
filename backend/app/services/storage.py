import boto3
from botocore.config import Config
from app.config import get_settings


def _get_s3_client():
    settings = get_settings()
    endpoint_url = (
        f"https://s3.{settings.aws_region}.amazonaws.com"
        if settings.aws_region
        else None
    )
    return boto3.client(
        "s3",
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        region_name=settings.aws_region,
        endpoint_url=endpoint_url,
        config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
    )


async def upload_file(content: bytes, key: str, content_type: str) -> str:
    """Upload file content to S3 and return the file URL."""
    settings = get_settings()
    client = _get_s3_client()
    client.put_object(
        Bucket=settings.s3_bucket_name,
        Key=key,
        Body=content,
        ContentType=content_type,
    )
    return f"s3://{settings.s3_bucket_name}/{key}"


async def get_download_url(key: str, expires_in: int = 3600) -> str:
    """Generate a presigned download URL for an S3 object."""
    settings = get_settings()
    client = _get_s3_client()
    url = client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket_name, "Key": key},
        ExpiresIn=expires_in,
    )
    return url


async def get_upload_url(key: str, content_type: str, expires_in: int = 3600) -> str:
    """Generate a presigned upload URL for direct browser uploads."""
    settings = get_settings()
    client = _get_s3_client()
    url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.s3_bucket_name,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )
    return url


async def download_file(key: str) -> bytes:
    """Download file content from S3."""
    settings = get_settings()
    client = _get_s3_client()
    # Extract key from s3:// URL if needed
    if key.startswith("s3://"):
        key = key.split("/", 3)[3]
    response = client.get_object(
        Bucket=settings.s3_bucket_name,
        Key=key,
    )
    return response["Body"].read()


async def head_file(key: str) -> dict:
    """Return object metadata for an S3 key or s3:// URL."""
    settings = get_settings()
    client = _get_s3_client()
    if key.startswith("s3://"):
        key = key.split("/", 3)[3]
    return client.head_object(
        Bucket=settings.s3_bucket_name,
        Key=key,
    )


async def delete_file(key: str) -> None:
    """Delete file from S3 key or s3:// URL."""
    settings = get_settings()
    client = _get_s3_client()
    if key.startswith("s3://"):
        key = key.split("/", 3)[3]
    client.delete_object(Bucket=settings.s3_bucket_name, Key=key)
