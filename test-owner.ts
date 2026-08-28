import { prisma } from './src/lib/prisma';

async function testOwnerActions() {
  console.log("=== Testing OWNER Actions ===");

  try {
    console.log("Authenticating via API (Sign Up)...");
    const uniqueEmail = `test-owner-${Date.now()}@gym.com`;
    const signupRes = await fetch("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000"
      },
      body: JSON.stringify({ email: uniqueEmail, password: "password123", name: "Test Owner" })
    });
    
    if (!signupRes.ok) {
      console.log("Signup failed!", await signupRes.text());
      return;
    }
    
    // Update role to OWNER
    const user = await prisma.user.findFirst({ where: { email: uniqueEmail } });
    if (user) {
      await prisma.user.update({ where: { id: user.id }, data: { role: 'OWNER' } });
      console.log("Role updated to OWNER for:", uniqueEmail);
    }
    
    const setCookieHeader = signupRes.headers.get("set-cookie");
    if (!setCookieHeader) {
      console.log("No cookie returned!");
      return;
    }

    // Extract better-auth.session_token
    const match = setCookieHeader.match(/better-auth\.session_token=([^;]+)/);
    if (!match) {
      console.log("Could not find better-auth.session_token cookie:", setCookieHeader);
      return;
    }
    const token = match[1];
    console.log("Logged in successfully. Token obtained.");

    const cookie = `better-auth.session_token=${token}`;

    console.log("\\n--- Testing Lockdown Toggle ---");
    const lockdownRes = await fetch("http://localhost:3000/api/settings/lockdown", {
      method: "PATCH",
      headers: { 
        "Content-Type": "application/json",
        "Cookie": cookie,
        "Origin": "http://localhost:3000"
      },
      body: JSON.stringify({ lockdownMode: true })
    });
    
    console.log("Lockdown Toggle Status:", lockdownRes.status);
    if (lockdownRes.ok) {
      console.log("Lockdown toggle SUCCESS!");
    } else {
      console.log("Lockdown toggle FAILED:", await lockdownRes.text());
    }

    console.log("\\n--- Testing Plan Creation ---");
    const planRes = await fetch("http://localhost:3000/api/plans", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Cookie": cookie,
        "Origin": "http://localhost:3000"
      },
      body: JSON.stringify({ name: "Subagent Test Plan", durationDays: 30, priceCents: 9999 })
    });
    
    console.log("Plan Creation Status:", planRes.status);
    if (planRes.ok) {
      console.log("Plan creation SUCCESS! Created Plan:", await planRes.json());
    } else {
      console.log("Plan creation FAILED:", await planRes.text());
    }

  } catch (err) {
    console.error(err);
  }
}

testOwnerActions();
