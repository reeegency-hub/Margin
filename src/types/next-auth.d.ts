import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      restaurantId: string;
      restaurantName: string;
      plan?: string | null;
      networkId?: string | null;
    };
  }

  interface User {
    restaurantId: string;
    restaurantName: string;
    sessionVersion?: number;
    plan?: string | null;
    networkId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    restaurantId?: string;
    restaurantName?: string;
    sessionVersion?: number;
    plan?: string | null;
    networkId?: string | null;
  }
}
