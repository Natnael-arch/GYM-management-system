const ZKLib = require('zkteco-js');

async function testConnection(ip, port, commKey) {
  console.log(`[Task 0] Attempting connection to ZKTeco MB1000 at ${ip}:${port} (Comm Key: ${commKey})...`);
  
  let zkInstance = new ZKLib(ip, port, 10000, 4000);
  
  try {
    console.log("Connecting...");
    await zkInstance.createSocket();
    console.log("Connection successful!");
    
    // Retrieve device info to confirm communication
    const info = await zkInstance.getInfo();
    console.log("[Device Info]", info);
    
    // Retrieve users list
    console.log("Fetching enrolled users...");
    const users = await zkInstance.getUsers();
    console.log(`[Users] Successfully fetched ${users.data.length} enrolled users.`);
    
    // Sample a user
    if (users.data.length > 0) {
       console.log("Sample User:", users.data[0]);
    }
    
    console.log("Test completely successful. Disconnecting...");
    await zkInstance.disconnect();
  } catch (error) {
    console.error("[Task 0 Failure] Connection or data retrieval failed.");
    console.error(error);
  }
}

const args = process.argv.slice(2);
const targetIp = args[0];
const targetPort = args[1] ? parseInt(args[1], 10) : 4370;
const targetKey = args[2] || '0';

testConnection(targetIp, targetPort, targetKey);
