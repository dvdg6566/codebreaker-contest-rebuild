import { Outlet } from "react-router";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "~/components/ui/sidebar";
import { AppSidebar } from "~/components/layout/app-sidebar";
import { Breadcrumbs } from "~/components/layout/breadcrumbs";
import { Separator } from "~/components/ui/separator";

interface AppLayoutProps {
  children?: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumbs />
        </header>
        <main className="flex-1 overflow-auto">
          <div className="flex flex-col gap-4 p-4 md:p-6">
            {children ?? <Outlet />}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
