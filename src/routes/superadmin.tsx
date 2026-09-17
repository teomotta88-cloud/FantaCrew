import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/superadmin")({
  component: SuperAdminLayout,
});

function SuperAdminLayout() {
  return <Outlet />;
}
