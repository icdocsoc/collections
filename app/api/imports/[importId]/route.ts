import { auth } from "@/auth";
import { getItemsInImport } from "@/lib/crud/importCsv";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ importId?: string }> };

export const GET = auth(async (request, { params: paramsPromise }: RouteContext) => {
    const params = await paramsPromise;
    if (!request.auth) {
        return NextResponse.json(
            {
                message: "Unauthorized",
            },
            { status: 401 },
        );
    }
    if (!params?.importId) {
        return NextResponse.json(
            {
                message: "importId is required",
            },
            { status: 400 },
        );
    }
    return NextResponse.json(await getItemsInImport(params.importId));
});
