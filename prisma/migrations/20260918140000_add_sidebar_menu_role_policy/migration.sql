CREATE TABLE "SidebarMenuPolicy" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "allowedRoles" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SidebarMenuPolicy_pkey" PRIMARY KEY ("id")
);
