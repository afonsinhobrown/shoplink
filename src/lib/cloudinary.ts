import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  throw new Error(
    "Cloudinary não configurado: defina CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET"
  );
}

cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });

const FORMATOS_ACEITES = ["jpg", "jpeg", "png", "webp", "gif", "avif"];
const TAMANHO_MAX_BYTES = 5 * 1024 * 1024;

export function cloudinaryConfigurado(): boolean {
  return Boolean(cloudName && apiKey && apiSecret);
}

export function validarImagem(file: File): string | null {
  if (!FORMATOS_ACEITES.includes(file.type.split("/")[1] ?? "")) {
    return "Formato não suportado (use JPG, PNG, WEBP, GIF ou AVIF)";
  }
  if (file.size > TAMANHO_MAX_BYTES) {
    return "Imagem demasiado grande (máximo 5 MB)";
  }
  return null;
}

export function urlThumbnail(url: string): string {
  return url.replace("/upload/", "/upload/c_fill,w_600,h_600,q_auto,f_auto/");
}

export async function uploadImagem(
  buffer: Buffer,
  produtoId: string,
  publicId?: string
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `shoplink/produtos/${produtoId}`,
        public_id: publicId,
        resource_type: "image",
        overwrite: true,
        transformation: [{ quality: "auto:good" }, { fetch_format: "auto" }],
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Falha no upload para o Cloudinary"));
        } else {
          resolve(result);
        }
      }
    );
    stream.end(buffer);
  });
}

export async function destroyImagem(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}