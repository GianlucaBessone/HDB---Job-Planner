const ONESIGNAL_API_URL = "https://onesignal.com/api/v1/notifications";
const ONESIGNAL_APP_ID = "35ce6a9c-c4c7-4645-98dc-b363dc91642b";

function getApiKey(): string {
    const rawKey = process.env.ONESIGNAL_REST_API_KEY;
    if (!rawKey) {
        throw new Error("[ONESIGNAL] ONESIGNAL_REST_API_KEY is not set in environment variables");
    }
    // Strip surrounding quotes if present (common .env issue)
    return rawKey.replace(/^"|"$/g, "");
}

interface SendPushParams {
    userIds?: string[];
    title: string;
    message: string;
    data?: any;
    forSupervisors?: boolean;
}

interface OneSignalResult {
    id?: string;
    recipients?: number;
    errors?: any;
    external_id?: string | null;
}

async function sendToOneSignal(payload: Record<string, any>): Promise<OneSignalResult> {
    const apiKey = getApiKey();

    console.log("📦 [ONESIGNAL_PAYLOAD_FULL]");
    console.log(JSON.stringify(payload, null, 2));
    console.log("🌍 [ONESIGNAL_ENDPOINT]", ONESIGNAL_API_URL);

    const response = await fetch(ONESIGNAL_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Basic ${apiKey}`,
        },
        body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    console.log("📨 [ONESIGNAL_RESPONSE_STATUS]", response.status);
    console.log("📨 [ONESIGNAL_RESPONSE_TEXT]", rawText);

    if (!response.ok) {
        console.error("❌ [ONESIGNAL_HTTP_ERROR]", {
            status: response.status,
            statusText: response.statusText,
            body: rawText,
        });
        throw new Error(`OneSignal HTTP ${response.status}: ${rawText}`);
    }

    let result: OneSignalResult;
    try {
        result = JSON.parse(rawText);
    } catch {
        console.error("❌ [ONESIGNAL_PARSE_ERROR] Could not parse response:", rawText);
        throw new Error(`OneSignal returned unparseable response: ${rawText}`);
    }

    if (result.errors) {
        console.error("⚠️ [ONESIGNAL_API_ERRORS]", result.errors);
    }

    if (result.recipients === 0) {
        console.error("⚠️ [ONESIGNAL_NO_RECIPIENTS] Push was accepted but delivered to 0 users. Response:", rawText);
    }

    return result;
}

export async function sendPushNotification({
    userIds,
    title,
    message,
    data,
    forSupervisors = false,
}: SendPushParams): Promise<OneSignalResult[]> {
    console.log("🚀 [ONESIGNAL_SEND_START]", {
        timestamp: new Date().toISOString(),
        userIds,
        forSupervisors,
        title,
        message,
    });

    console.log("🔑 [ENV_CHECK]", {
        hasApiKey: !!process.env.ONESIGNAL_REST_API_KEY,
        apiKeyLength: process.env.ONESIGNAL_REST_API_KEY?.length,
        appId: ONESIGNAL_APP_ID,
    });

    const baseBody = {
        app_id: ONESIGNAL_APP_ID,
        headings: { en: title, es: title },
        contents: { en: message, es: message },
        data: data || {},
    };

    const results: OneSignalResult[] = [];

    // 1. Send to supervisors/admins via tag filters
    if (forSupervisors) {
        console.log("🏷️ [ONESIGNAL_SUPERVISOR_PUSH] Sending to supervisors via filters");
        try {
            const result = await sendToOneSignal({
                ...baseBody,
                filters: [
                    { field: "tag", key: "role", relation: "=", value: "supervisor" },
                    { operator: "OR" },
                    { field: "tag", key: "role", relation: "=", value: "admin" },
                ],
            });
            results.push(result);
        } catch (error) {
            console.error("❌ [ONESIGNAL_SUPERVISOR_ERROR]", error);
        }
    }

    // 2. Send to specific users by external_user_id
    if (userIds && userIds.length > 0) {
        console.log("🎯 [TARGETING] Using include_external_user_ids:", userIds);
        try {
            const result = await sendToOneSignal({
                ...baseBody,
                include_external_user_ids: userIds,
            });
            results.push(result);
        } catch (error) {
            console.error("❌ [ONESIGNAL_TARGETED_ERROR]", error);
        }
    }

    if (!forSupervisors && (!userIds || userIds.length === 0)) {
        console.warn("⚠️ [ONESIGNAL_NO_TARGET] sendPushNotification called with no targets (forSupervisors=false, userIds empty)");
    }

    console.log("✅ [ONESIGNAL_SEND_COMPLETE]", {
        totalResults: results.length,
        results: results.map(r => ({
            id: r.id,
            recipients: r.recipients,
            hasErrors: !!r.errors,
        })),
    });

    return results;
}
