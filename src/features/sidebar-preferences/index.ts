export { SidebarPreferenceProvider, useSidebarPreference } from "./components/sidebar-preference-provider";
export { SidebarMenuOrderCard } from "./components/sidebar-menu-order-card";
export type { SidebarPreferenceSaveStatus } from "./components/sidebar-preference-provider";
export { addSidebarDivider, canAccessSidebarMenu, canConfigureSidebarMenuRole, DEFAULT_SIDEBAR_ITEM_ORDER, DEFAULT_SIDEBAR_MENU_ALLOWED_ROLES, DEFAULT_SIDEBAR_PREFERENCE, getAuthorizedSidebarItems, getAuthorizedSidebarMenus, getOrderedSidebarItems, getSidebarMenuLabel, getSidebarNavigationItems, getSidebarOrderItemId, isSidebarDividerId, isSidebarPermissionAllowed, moveSidebarItem, normalizeSidebarItemsForRender, normalizeSidebarMenuAllowedRoles, normalizeSidebarPreference, orderSidebarMenus, removeSidebarDivider } from "./domain/sidebar-preference";
export type { SidebarDividerOrderItem, SidebarMenuAllowedRoles, SidebarMenuOrderItem, SidebarNavigationItem, SidebarOrderItem, SidebarOrderItemId, SidebarPreferenceValue } from "./domain/sidebar-preference";
export { DEFAULT_SIDEBAR_MENU_ORDER, MOBILE_NAVIGATION_ITEMS, SIDEBAR_MENU_ITEMS, findSidebarMenu, isDeveloperRequiredSidebarMenu, isSidebarMenuHideable, isSidebarMenuId } from "./domain/sidebar-menu";
export type { SidebarMenuDefinition, SidebarMenuId } from "./domain/sidebar-menu";
