exports.handler = async (event) => {
	if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

	try {
		const body = JSON.parse(event.body || "{}");
		const name = (body.name || "").trim();
		const tag = (body.tag || "").trim();
		if (!name || !tag) return { statusCode: 400, body: "name and tag required" };

		const owner = process.env.GITHUB_OWNER;
		const repo = process.env.GITHUB_REPO;
		const branch = process.env.GITHUB_BRANCH || "main";
		const token = process.env.GITHUB_TOKEN;
		if (!owner || !repo || !token) return { statusCode: 500, body: "Server not configured (missing env vars)" };

		const filepath = "categories.json";
		const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${filepath}`;

		const getRes = await fetch(`${apiBase}?ref=${branch}`, {
			headers: { Authorization: `token ${token}`, "User-Agent": "netlify-function" },
		});
		if (!getRes.ok) {
			const text = await getRes.text();
			return { statusCode: getRes.status, body: `Failed to fetch categories.json: ${text}` };
		}
		const getJson = await getRes.json();
		const currentSha = getJson.sha;
		const contentBase64 = getJson.content;
		const currentText = Buffer.from(contentBase64, "base64").toString("utf8");
		let arr = JSON.parse(currentText);

		if (!arr.some((c) => c.tag === tag)) {
			arr.push({ name, tag });
			arr.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
		} else {
			return { statusCode: 200, body: JSON.stringify({ ok: true, message: "Category already exists" }) };
		}

		const updatedContent = Buffer.from(JSON.stringify(arr, null, 2)).toString("base64");

		const putRes = await fetch(`${apiBase}`, {
			method: "PUT",
			headers: {
				Authorization: `token ${token}`,
				"User-Agent": "netlify-function",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				message: `Add category ${tag}`,
				content: updatedContent,
				sha: currentSha,
				branch,
			}),
		});

		if (!putRes.ok) {
			const text = await putRes.text();
			return { statusCode: putRes.status, body: `Failed to update categories.json: ${text}` };
		}
		const putJson = await putRes.json();
		return { statusCode: 200, body: JSON.stringify({ ok: true, result: putJson }) };
	} catch (err) {
		return { statusCode: 500, body: String(err) };
	}
};
