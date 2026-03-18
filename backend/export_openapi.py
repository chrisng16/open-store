import json
from app.main import app
from fastapi.openapi.utils import get_openapi

def snake_to_camel(snake_str):
    components = snake_str.split("_")
    return components[0] + "".join(x.title() for x in components[1:])

def patch_openapi_schema(schema):
    """
    Recursively transform all property names in the OpenAPI schema from snake_case to camelCase.
    """
    if isinstance(schema, list):
        for item in schema:
            patch_openapi_schema(item)
    elif isinstance(schema, dict):
        if "properties" in schema:
            new_properties = {}
            for key, value in schema["properties"].items():
                new_key = snake_to_camel(key)
                new_properties[new_key] = value
                patch_openapi_schema(value)
            schema["properties"] = new_properties
        
        if "required" in schema and isinstance(schema["required"], list):
            schema["required"] = [snake_to_camel(key) for key in schema["required"]]
            
        for key, value in schema.items():
            if key != "properties":
                patch_openapi_schema(value)

def export_openapi():
    # Use the app's default OpenAPI schema generation
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        openapi_version=app.openapi_version,
        description=app.description,
        routes=app.routes,
    )
    
    # Patch the schema to use camelCase
    patch_openapi_schema(openapi_schema)
    
    with open("openapi.json", "w") as f:
        json.dump(openapi_schema, f, indent=2)
    print("OpenAPI schema exported to openapi.json (with camelCase properties)")

if __name__ == "__main__":
    export_openapi()
