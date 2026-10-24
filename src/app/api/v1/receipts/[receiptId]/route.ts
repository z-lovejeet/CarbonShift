import { publicReceiptHandler } from "@/server/publication/public-handler";
export async function GET(request: Request, { params }: { params: Promise<{ receiptId: string }> }) { return publicReceiptHandler(request, (await params).receiptId, "summary"); }
