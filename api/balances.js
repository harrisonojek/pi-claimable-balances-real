module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const claimant = String(req.query.claimant || "").trim();

  if (!/^G[A-Z2-7]{55}$/.test(claimant)) {
    return res.status(400).json({
      error: "Please enter a valid Pi Mainnet public address."
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const url = new URL(
      "https://api.mainnet.minepi.com/claimable_balances"
    );

    url.searchParams.set("claimant", claimant);
    url.searchParams.set("limit", "10");

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      return res.status(502).json({
        error: "The Pi Mainnet API could not complete the request."
      });
    }

    const data = await response.json();

    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({
      error: "Unable to retrieve balances. Please try again."
    });
  } finally {
    clearTimeout(timeout);
  }
};
