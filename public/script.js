const API_BASE_URL = "https://discord-openai-bot-0vmd.onrender.com";
// const API_BASE_URL = "http://localhost:3000";

document.getElementById("sendBtn").onclick = async () => {
  const message = document.getElementById("message").value;
  const password = document.getElementById("password").value;

  const payload = {
    message: message,
    channelId: "1354513880969121832",
    password,
  };

  try {
    const res = await fetch(`${API_BASE_URL}/send-remote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    alert(text); // Show success or error response
  } catch (err) {
    alert("❌ Failed to send message");
    console.error(err);
  }
};

async function fetchStatus() {
  try {
    const res = await fetch(`${API_BASE_URL}/status`);
    const data = await res.json();

    const text = `
      <div class="statusDiv">
        <h3>System Status</h3>
        <p>Status: ${data.status}</p>
        <p>Mode: ${
          data.mode === "prod"
            ? "production"
            : data.mode === "dev"
            ? "development"
            : "unknown"
        }</p>
        <p>Model: ${data.model}</p>
        <p>Channel ID: ${data.channelId}</p>
      </div>
    `;

    document.getElementById("statusBox").innerHTML = text;
  } catch (err) {
    document.getElementById("statusOutput").textContent =
      "⚠️ Failed to load status.";
    console.error(err);
  }
}

fetchStatus();

document
  .getElementById("fetchMemoryBtn")
  .addEventListener("click", async () => {
    const userId = document.getElementById("userIdInput").value.trim();
    const outputDiv = document.getElementById("memoryOutput");

    if (!userId) {
      outputDiv.innerText = "Please enter a user ID.";
      return;
    }

    outputDiv.innerText = "Loading...";

    try {
      const response = await fetch(`/api/admin/memory/${userId}`);
      const data = await response.json();

      if (!data.success) {
        outputDiv.innerText = "Failed to fetch memory.";
        return;
      }

      if (!data.memory.length) {
        outputDiv.innerText = "No memory found for this user.";
        return;
      }

      // Format and display memory messages
      outputDiv.innerHTML = data.memory
        .map(
          (msg) =>
            `<p><strong>${msg.role}</strong> (${msg.name}): ${msg.content}</p>`
        )
        .join("");
    } catch (err) {
      console.error(err);
      outputDiv.innerText = "Error fetching memory.";
    }
  });
