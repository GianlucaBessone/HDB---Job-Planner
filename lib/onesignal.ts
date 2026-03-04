
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
    // Strip surrounding quotes if present in env var
    const rawKey = process.env.ONESIGNAL_REST_API_KEY;
    const apiKey = rawKey ? rawKey.replace(/^"|"$/g, "") : undefined;

    if (!apiKey) {
        console.warn("OneSignal API Key not found or empty. Push notification not sent.");
        return;
    }

    const baseBody: any = {
        app_id: appId,
        headings: { en: title, es: title },
        contents: { en: message, es: message },
        data: data || {},
    };

    const results = [];

    const headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${apiKey}`,
    };

    // 1. If for supervisors, send using filters
    if (forSupervisors) {
        console.log("OneSignal: Sending push to supervisors/admins via filters...");
        try {
            const response = await fetch("https://onesignal.com/api/v1/notifications", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    ...baseBody,
                    filters: [
                        { field: "tag", key: "role", relation: "=", value: "supervisor" },
                        { operator: "OR" },
                        { field: "tag", key: "role", relation: "=", value: "admin" }
                    ],
                    target_channel: "push"
                }),
            });
            const resData = await response.json();
            console.log("OneSignal Supervisor Result:", JSON.stringify(resData));
            results.push(resData);
        } catch (e) {
            console.error("OneSignal supervisor filter push error:", e);
        }
    }

    // 2. If there are specific users, send to them
    if (userIds && userIds.length > 0) {
        console.log("OneSignal: Sending push to specific external user IDs:", userIds);
        try {
            const body: any = {
                ...baseBody,
                include_external_user_ids: userIds,
                target_channel: "push"
            };

            const response = await fetch("https://onesignal.com/api/v1/notifications", {
                method: "POST",
                headers,
                body: JSON.stringify(body),
            });

            const resData = await response.json();
            console.log("OneSignal Targeted Users Result:", JSON.stringify(resData));
            results.push(resData);

            if (resData.errors) {
                console.warn("OneSignal API reported errors for targeted users:", resData.errors);
            }
        } catch (e) {
            console.error("OneSignal targeted push error:", e);
        }
    }





    return results.length === 1 ? results[0] : results;
}

