
export async function sendPushNotification({
    userIds,
    title,
    message,
    data,
    forSupervisors = false,
}: {
    userIds?: string[],
    title: string,
    message: string,
    data?: any,
    forSupervisors?: boolean
}) {
    console.log("🚀 [ONESIGNAL_SEND_START]", {
        timestamp: new Date().toISOString(),
        userIds,
        forSupervisors,
        title,
        message
    });

    console.log("🔑 [ENV_CHECK]", {
        hasAppId: !!process.env.ONESIGNAL_APP_ID,
        hasApiKey: !!process.env.ONESIGNAL_REST_API_KEY,
        appId: process.env.ONESIGNAL_APP_ID || "not_set"
    });

    const appId = "35ce6a9c-c4c7-4645-98dc-b363dc91642b";
    const rawKey = process.env.ONESIGNAL_REST_API_KEY;
    const apiKey = rawKey ? rawKey.replace(/^"|"$/g, "") : undefined;

    if (!apiKey) {
        console.warn("OneSignal API Key not found. Push notification not sent.");
        return;
    }

    const baseBody: any = {
        app_id: appId,
        headings: { en: title, es: title },
        contents: { en: message, es: message },
        data: data || {},
    };

    const results: any[] = [];
    const headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${apiKey}`,
    };

    const sendRequest = async (payload: any, description: string) => {
        console.log("📦 [ONESIGNAL_PAYLOAD_FULL]");
        console.log(JSON.stringify(payload, null, 2));

        if (payload.include_external_user_ids) {
            console.log("🎯 [TARGETING] Using external_user_ids:", payload.include_external_user_ids);
        }

        console.log("🌍 [ONESIGNAL_ENDPOINT]", "https://onesignal.com/api/v1/notifications");

        try {
            const response = await fetch("https://onesignal.com/api/v1/notifications", {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
            });

            const rawText = await response.text();
            console.log("📨 [ONESIGNAL_RESPONSE_STATUS]", response.status);
            console.log("📨 [ONESIGNAL_RESPONSE_TEXT]", rawText);

            let resData;
            try {
                resData = JSON.parse(rawText);
            } catch (e) {
                resData = { parse_error: true, text: rawText };
            }

            if (resData.errors || (resData.recipients === 0)) {
                console.error("⚠️ [ONESIGNAL_NO_RECIPIENTS]", rawText);
            }

            results.push(resData);
        } catch (error) {
            console.error("❌ [ONESIGNAL_ERROR]:", error);
        }
    };

    // 1. Supervisors via filters
    if (forSupervisors) {
        const payload = {
            ...baseBody,
            filters: [
                { field: "tag", key: "role", relation: "=", value: "supervisor" },
                { operator: "OR" },
                { field: "tag", key: "role", relation: "=", value: "admin" },
            ],
        };
        await sendRequest(payload, "supervisor filter push");
    }

    // 2. Specific users via external_user_ids
    if (userIds && userIds.length > 0) {
        const payload = {
            ...baseBody,
            include_external_user_ids: userIds
        };
        await sendRequest(payload, "targeted user push (external_ids)");
    }

    if (results.length === 0) {
        console.warn("OneSignal: No targets defined for push.");
    }

    return results.length === 1 ? results[0] : results;
}

