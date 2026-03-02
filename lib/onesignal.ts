
export async function sendPushNotification({
    userIds,
    title,
    message,
    data,
    forSupervisors = false
}: {
    userIds?: string[],
    title: string,
    message: string,
    data?: any,
    forSupervisors?: boolean
}) {
    const appId = "35ce6a9c-c4c7-4645-98dc-b363dc91642b";
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;

    if (!apiKey) {
        console.warn("OneSignal API Key not found in environment variables. Push notification not sent.");
        return;
    }

    const baseBody: any = {
        app_id: appId,
        headings: { en: title, es: title },
        contents: { en: message, es: message },
        data: data || {},
    };

    const results = [];

    // 1. If for supervisors, send using filters
    if (forSupervisors) {
        try {
            const response = await fetch("https://onesignal.com/api/v1/notifications", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    Authorization: `Basic ${apiKey}`,
                },
                body: JSON.stringify({
                    ...baseBody,
                    filters: [
                        { field: "tag", key: "role", relation: "=", value: "supervisor" },
                        { operator: "OR" },
                        { field: "tag", key: "role", relation: "=", value: "admin" }
                    ]
                }),
            });
            results.push(await response.json());
        } catch (e) {
            console.error("OneSignal supervisor filter push error:", e);
        }
    }

    // 2. If there are specific users, send to them
    // If forSupervisors was true, we only send to userIds if they are NOT redundant, 
    // but for simplicity we can send both or just skip if userIds is already covered.
    // Actually, usually it's cleaner to just push to both targets. 
    if (userIds && userIds.length > 0) {
        try {
            const response = await fetch("https://onesignal.com/api/v1/notifications", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    Authorization: `Basic ${apiKey}`,
                },
                body: JSON.stringify({ ...baseBody, include_external_user_ids: userIds }),
            });
            results.push(await response.json());
        } catch (e) {
            console.error("OneSignal targeted push error:", e);
        }
    }

    return results.length === 1 ? results[0] : results;
}
