-- CreateEnum
CREATE TYPE "AgencyRole" AS ENUM ('OWNER', 'ADMIN', 'SALES', 'PRODUCTION', 'FINANCE', 'VIEWER');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('LEAD', 'PROSPECT', 'CUSTOMER', 'PARTNER', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RecordPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('DISCOVERED', 'QUALIFIED', 'NEEDS_ANALYSIS', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'WEBSITE_AUDIT', 'PROPOSAL_SENT', 'STATUS_CHANGE');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "WorkItemStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'VOID');

-- CreateTable
CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'COP',
    "timezone" TEXT NOT NULL DEFAULT 'America/Bogota',
    "baseHourlyRate" DECIMAL(14,2) NOT NULL DEFAULT 100000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "disabledAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AgencyRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "website" TEXT,
    "industry" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'CO',
    "type" "AccountType" NOT NULL DEFAULT 'LEAD',
    "priority" "RecordPriority" NOT NULL DEFAULT 'NORMAL',
    "source" TEXT,
    "serviceInterest" TEXT,
    "notes" TEXT,
    "nextFollowUpAt" TIMESTAMP(3),
    "lastContactAt" TIMESTAMP(3),
    "ownerId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "externalId" TEXT,
    "accountId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "externalId" TEXT,
    "accountId" TEXT NOT NULL,
    "primaryContactId" TEXT,
    "ownerId" TEXT,
    "referralPartnerId" TEXT,
    "name" TEXT NOT NULL,
    "serviceName" TEXT,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'DISCOVERED',
    "amount" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "probability" INTEGER,
    "expectedCloseAt" TIMESTAMP(3),
    "actualCloseAt" TIMESTAMP(3),
    "lostReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "externalId" TEXT,
    "accountId" TEXT,
    "contactId" TEXT,
    "opportunityId" TEXT,
    "assigneeId" TEXT,
    "type" "ActivityType" NOT NULL,
    "status" "ActivityStatus" NOT NULL DEFAULT 'OPEN',
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteAudit" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "accountId" TEXT,
    "opportunityId" TEXT,
    "authorId" TEXT,
    "requestedUrl" TEXT NOT NULL,
    "finalUrl" TEXT,
    "httpStatus" INTEGER,
    "responseTimeMs" INTEGER,
    "htmlBytes" INTEGER,
    "overallScore" INTEGER,
    "opportunityScore" INTEGER,
    "classification" TEXT,
    "scoringVersion" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "auditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signals" JSONB NOT NULL,
    "findings" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "cycle" TEXT,
    "defaultPrice" DECIMAL(14,2),
    "estimatedCost" DECIMAL(14,2),
    "estimatedHours" DECIMAL(10,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "externalId" TEXT,
    "accountId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "authorId" TEXT,
    "number" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "estimatedHours" DECIMAL(10,2),
    "hourlyRate" DECIMAL(14,2),
    "validUntil" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "documentUrl" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalItem" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "serviceId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'servicio',
    "unitPrice" DECIMAL(14,2),
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProposalItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "externalId" TEXT,
    "accountId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "startAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "budget" DECIMAL(14,2),
    "plannedCost" DECIMAL(14,2),
    "actualCost" DECIMAL(14,2),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "deliverablesUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceProposalId" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "externalId" TEXT,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "assigneeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkItemStatus" NOT NULL DEFAULT 'TODO',
    "priority" "RecordPriority" NOT NULL DEFAULT 'NORMAL',
    "dueAt" TIMESTAMP(3),
    "estimateHours" DECIMAL(10,2),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "externalId" TEXT,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "userId" TEXT,
    "workDate" TIMESTAMP(3) NOT NULL,
    "hours" DECIMAL(8,2) NOT NULL,
    "costRate" DECIMAL(14,2),
    "billableRate" DECIMAL(14,2),
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "externalId" TEXT,
    "accountId" TEXT NOT NULL,
    "projectId" TEXT,
    "number" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralPartner" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "externalId" TEXT,
    "accountId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "commissionRate" DECIMAL(5,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralCommission" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "externalId" TEXT,
    "partnerId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "collectedRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "attributedCosts" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netProfit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "commissionRate" DECIMAL(5,2) NOT NULL,
    "amountDue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agency_slug_key" ON "Agency"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_disabledAt_idx" ON "User"("disabledAt");

-- CreateIndex
CREATE INDEX "Membership_userId_role_idx" ON "Membership"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_agencyId_userId_key" ON "Membership"("agencyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_expiresAt_idx" ON "AuthSession"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_agencyId_expiresAt_idx" ON "AuthSession"("agencyId", "expiresAt");

-- CreateIndex
CREATE INDEX "Account_agencyId_type_updatedAt_idx" ON "Account"("agencyId", "type", "updatedAt");

-- CreateIndex
CREATE INDEX "Account_agencyId_ownerId_type_idx" ON "Account"("agencyId", "ownerId", "type");

-- CreateIndex
CREATE INDEX "Account_agencyId_nextFollowUpAt_idx" ON "Account"("agencyId", "nextFollowUpAt");

-- CreateIndex
CREATE INDEX "Account_agencyId_name_idx" ON "Account"("agencyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Account_agencyId_taxId_key" ON "Account"("agencyId", "taxId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_agencyId_externalId_key" ON "Account"("agencyId", "externalId");

-- CreateIndex
CREATE INDEX "Contact_agencyId_accountId_isPrimary_idx" ON "Contact"("agencyId", "accountId", "isPrimary");

-- CreateIndex
CREATE INDEX "Contact_agencyId_email_idx" ON "Contact"("agencyId", "email");

-- CreateIndex
CREATE INDEX "Contact_agencyId_phone_idx" ON "Contact"("agencyId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_agencyId_externalId_key" ON "Contact"("agencyId", "externalId");

-- CreateIndex
CREATE INDEX "Opportunity_agencyId_stage_expectedCloseAt_idx" ON "Opportunity"("agencyId", "stage", "expectedCloseAt");

-- CreateIndex
CREATE INDEX "Opportunity_agencyId_ownerId_stage_idx" ON "Opportunity"("agencyId", "ownerId", "stage");

-- CreateIndex
CREATE INDEX "Opportunity_agencyId_accountId_updatedAt_idx" ON "Opportunity"("agencyId", "accountId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_agencyId_externalId_key" ON "Opportunity"("agencyId", "externalId");

-- CreateIndex
CREATE INDEX "Activity_agencyId_status_dueAt_idx" ON "Activity"("agencyId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "Activity_agencyId_accountId_createdAt_idx" ON "Activity"("agencyId", "accountId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_agencyId_opportunityId_createdAt_idx" ON "Activity"("agencyId", "opportunityId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_agencyId_assigneeId_status_dueAt_idx" ON "Activity"("agencyId", "assigneeId", "status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_agencyId_externalId_key" ON "Activity"("agencyId", "externalId");

-- CreateIndex
CREATE INDEX "WebsiteAudit_agencyId_accountId_auditedAt_idx" ON "WebsiteAudit"("agencyId", "accountId", "auditedAt");

-- CreateIndex
CREATE INDEX "WebsiteAudit_agencyId_opportunityId_auditedAt_idx" ON "WebsiteAudit"("agencyId", "opportunityId", "auditedAt");

-- CreateIndex
CREATE INDEX "WebsiteAudit_agencyId_auditedAt_idx" ON "WebsiteAudit"("agencyId", "auditedAt");

-- CreateIndex
CREATE INDEX "Service_agencyId_active_category_idx" ON "Service"("agencyId", "active", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Service_agencyId_name_key" ON "Service"("agencyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Service_agencyId_externalId_key" ON "Service"("agencyId", "externalId");

-- CreateIndex
CREATE INDEX "Proposal_agencyId_status_updatedAt_idx" ON "Proposal"("agencyId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Proposal_agencyId_accountId_createdAt_idx" ON "Proposal"("agencyId", "accountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_agencyId_number_version_key" ON "Proposal"("agencyId", "number", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_agencyId_externalId_key" ON "Proposal"("agencyId", "externalId");

-- CreateIndex
CREATE INDEX "ProposalItem_proposalId_sortOrder_idx" ON "ProposalItem"("proposalId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Project_sourceProposalId_key" ON "Project"("sourceProposalId");

-- CreateIndex
CREATE INDEX "Project_agencyId_status_dueAt_idx" ON "Project"("agencyId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "Project_agencyId_accountId_status_idx" ON "Project"("agencyId", "accountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Project_agencyId_externalId_key" ON "Project"("agencyId", "externalId");

-- CreateIndex
CREATE INDEX "WorkItem_agencyId_projectId_status_dueAt_idx" ON "WorkItem"("agencyId", "projectId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "WorkItem_agencyId_assigneeId_status_dueAt_idx" ON "WorkItem"("agencyId", "assigneeId", "status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkItem_agencyId_externalId_key" ON "WorkItem"("agencyId", "externalId");

-- CreateIndex
CREATE INDEX "TimeEntry_agencyId_projectId_workDate_idx" ON "TimeEntry"("agencyId", "projectId", "workDate");

-- CreateIndex
CREATE INDEX "TimeEntry_agencyId_userId_workDate_idx" ON "TimeEntry"("agencyId", "userId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "TimeEntry_agencyId_externalId_key" ON "TimeEntry"("agencyId", "externalId");

-- CreateIndex
CREATE INDEX "Invoice_agencyId_status_dueAt_idx" ON "Invoice"("agencyId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "Invoice_agencyId_accountId_issuedAt_idx" ON "Invoice"("agencyId", "accountId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_agencyId_number_key" ON "Invoice"("agencyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_agencyId_externalId_key" ON "Invoice"("agencyId", "externalId");

-- CreateIndex
CREATE INDEX "Payment_agencyId_invoiceId_paidAt_idx" ON "Payment"("agencyId", "invoiceId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralPartner_accountId_key" ON "ReferralPartner"("accountId");

-- CreateIndex
CREATE INDEX "ReferralPartner_agencyId_active_idx" ON "ReferralPartner"("agencyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralPartner_agencyId_code_key" ON "ReferralPartner"("agencyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralPartner_agencyId_externalId_key" ON "ReferralPartner"("agencyId", "externalId");

-- CreateIndex
CREATE INDEX "ReferralCommission_agencyId_status_createdAt_idx" ON "ReferralCommission"("agencyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ReferralCommission_agencyId_partnerId_status_idx" ON "ReferralCommission"("agencyId", "partnerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCommission_agencyId_externalId_key" ON "ReferralCommission"("agencyId", "externalId");

-- CreateIndex
CREATE INDEX "AuditEvent_agencyId_entityType_entityId_createdAt_idx" ON "AuditEvent"("agencyId", "entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_agencyId_actorId_createdAt_idx" ON "AuditEvent"("agencyId", "actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_primaryContactId_fkey" FOREIGN KEY ("primaryContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_referralPartnerId_fkey" FOREIGN KEY ("referralPartnerId") REFERENCES "ReferralPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteAudit" ADD CONSTRAINT "WebsiteAudit_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteAudit" ADD CONSTRAINT "WebsiteAudit_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteAudit" ADD CONSTRAINT "WebsiteAudit_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteAudit" ADD CONSTRAINT "WebsiteAudit_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalItem" ADD CONSTRAINT "ProposalItem_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalItem" ADD CONSTRAINT "ProposalItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_sourceProposalId_fkey" FOREIGN KEY ("sourceProposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralPartner" ADD CONSTRAINT "ReferralPartner_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralPartner" ADD CONSTRAINT "ReferralPartner_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ReferralPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

