import { fetchWithAccessToken } from "@/lib/auth-fetch";
import { denormalizeRequest } from "@/lib/normalize-response";

export type UploadIntent =
    | "menuImportFile"
    | "productImage"
    | "menu_import_file"
    | "product_image";

function toBackendIntent(intent: UploadIntent): "menu_import_file" | "product_image" {
    if (intent === "menuImportFile" || intent === "menu_import_file") {
        return "menu_import_file";
    }
    return "product_image";
}

type UploadIntentResponse = {
    uploadId: string;
    uploadUrl: string;
};

type UploadCompleteResponse = {
    uploadId: string;
    status: string;
    fileUrl: string;
};

export async function uploadFileWithSignedUrl(
    storeId: string,
    file: File,
    intent: UploadIntent
): Promise<UploadCompleteResponse> {
    const contentType = file.type || "application/octet-stream";

    const uploadIntent = await fetchWithAccessToken<UploadIntentResponse>(
        `/stores/${storeId}/uploads/intents`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
                denormalizeRequest({
                    intent: toBackendIntent(intent),
                    filename: file.name,
                    contentType,
                    sizeBytes: file.size,
                })
            ),
        }
    );

    const uploadResponse = await fetch(uploadIntent.uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Type": contentType,
        },
        body: file,
    });

    if (!uploadResponse.ok) {
        throw new Error("Direct upload failed");
    }

    return fetchWithAccessToken<UploadCompleteResponse>(
        `/stores/${storeId}/uploads/${uploadIntent.uploadId}/complete`,
        { method: "POST" }
    );
}
