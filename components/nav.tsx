import { getCurrentUser } from "@/lib/auth";
import NavBar from "./nav-bar";

export default async function Nav() {
  const user = await getCurrentUser();
  return <NavBar loggedIn={!!user} nickname={user?.nickname ?? null} />;
}
