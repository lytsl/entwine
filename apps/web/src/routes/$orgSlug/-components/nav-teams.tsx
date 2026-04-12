"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Archive,
  Bell,
  BoxIcon,
  ChevronRight,
  LayersIcon,
  LinkIcon,
  MoreHorizontal,
  Settings,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from "@/components/ui/sidebar";
import IssueIcon from "@/icons/issue-icon";
import { authClient } from "@/lib/auth-client";
import { shortcutRegistry } from "@/lib/shortcut-registry";
import { Route } from "../layout";
import { NavGroup } from "./nav-group";
import { NavMenuItem } from "./nav-menu-item";

const teamItems = [
  {
    title: "Issues",
    url: "#",
    icon: IssueIcon,
    tooltip: shortcutRegistry["G->I"],
  },
  {
    title: "Projects",
    url: "#",
    icon: BoxIcon,
    tooltip: shortcutRegistry["G->I"],
  },
  {
    title: "Views",
    url: "#",
    icon: LayersIcon,
    tooltip: shortcutRegistry["G->I"],
  },
];

// export function

export function NavTeams() {
  const { session } = Route.useRouteContext();

  const teams = [];

  return (
    <NavGroup label="Your teams">
      {teams.map((item, index) => (
        <Collapsible
          key={item.name}
          render={<SidebarMenuItem />}
          defaultOpen={index === 0}
          className="group/sidebar-menu-item"
        >
          <CollapsibleTrigger render={<SidebarMenuButton className="gap-0" />}>
            <div
              style={{
                background: (item as any)?.metadata?.color,
              }}
              className="inline-flex size-4.5 items-center justify-center rounded bg-primary text-2xs text-primary-foreground"
            >
              <span>{(item as any)?.metadata?.emoji}</span>
            </div>
            <span className="ms-1.5 me-1">{item.name}</span>
            <ChevronRight className="size-3! fill-[oklch(0.6698_0.0026_271.4)] text-[oklch(0.6698_0.0026_271.4)] transition-transform group-data-open/sidebar-menu-item:rotate-90" />

            <DropdownMenu>
              <DropdownMenuTrigger
                render={<SidebarMenuAction render={<div />} showOnHover />}
                className={"ms-auto"}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <MoreHorizontal />
                <span className="sr-only">More</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-48 rounded-lg"
                side="right"
                align="start"
              >
                <DropdownMenuItem>
                  <Settings />
                  <span>Team settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <LinkIcon />
                  <span>Copy link</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Archive />
                  <span>Open archive</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Bell />
                  <span>Subscribe</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <span>Leave team...</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {teamItems.map((teamItem) => (
                <NavMenuItem item={teamItem} key={teamItem.title} />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </NavGroup>
  );
}
