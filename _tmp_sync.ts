import { PrismaClient } from "@prisma/client";
import { zktecoService } from "./src/lib/zkteco";
const p = new PrismaClient();

zktecoService.connect().then(async () => {
  console.log("Deleting device user 4727 (kebede elias - no membership)...");
  const res = await zktecoService.deleteUser("4727");
  console.log("Result:", res);
  await zktecoService.disconnect();
  await p.$disconnect();
}).catch(err => {
  console.error(err);
  p.$disconnect();
});
