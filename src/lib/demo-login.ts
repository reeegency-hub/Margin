/** Auto-login démo : en prod uniquement si DEMO_AUTO_LOGIN=1 ; sinon en local. */
export function isDemoAutoLoginEnabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return process.env.DEMO_AUTO_LOGIN === "1";
  }
  return process.env.DEMO_AUTO_LOGIN !== "0";
}
