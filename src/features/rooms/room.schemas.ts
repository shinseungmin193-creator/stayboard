import { z } from "zod";
import { NAME_MAX_LENGTH, ROOM_CAPACITY_MAX } from "../../lib/constants";
import { CALENDAR_SOURCE_NAME_MAX_LENGTH, CALENDAR_URL_MAX_LENGTH } from "../calendar-sources/calendar-source.constants";
import { ROOM_OPERATIONAL_STATUS_VALUES } from "./room-operational-status";
import { ROOM_CALENDAR_PROVIDER_CONFIG, type RoomCalendarProvider } from "./room-calendar-draft";
import { REVIEW_PROVIDER_TYPES } from "../reviews/domain/listing-provider";
import { ROOM_LISTING_URL_MAX_LENGTH } from "./room-listing";

export const roomInputSchema = z.object({
  propertyId: z.string().trim().min(1, "숙소를 선택해 주세요."),
  name: z.string().trim().min(1, "객실명을 입력해 주세요.").max(NAME_MAX_LENGTH),
  capacity: z.coerce.number().int("수용 인원은 정수여야 합니다.").min(1, "수용 인원은 1명 이상이어야 합니다.").max(ROOM_CAPACITY_MAX),
});
export const roomUpdateSchema = roomInputSchema.extend({ id: z.string().trim().min(1) });
export const roomActiveSchema = z.object({ id: z.string().trim().min(1), isActive: z.enum(["true", "false"]).transform((value) => value === "true") });
export const roomOperationalStatusSchema = z.object({ roomId: z.string().trim().min(1), operationalStatus: z.enum(ROOM_OPERATIONAL_STATUS_VALUES) });

const roomCalendarProviderSchema = z.custom<RoomCalendarProvider>(
  (value) => typeof value === "string" && ROOM_CALENDAR_PROVIDER_CONFIG.some((item) => item.provider === value),
  "지원하는 OTA Provider를 선택해 주세요.",
);
const roomCalendarSourceBaseSchema = z.object({
  clientKey: z.string().trim().min(1).max(120),
  provider: roomCalendarProviderSchema,
  name: z.string().trim().max(CALENDAR_SOURCE_NAME_MAX_LENGTH),
  calendarUrl: z.string().trim().max(CALENDAR_URL_MAX_LENGTH),
  testedCalendarUrl: z.string().trim().max(CALENDAR_URL_MAX_LENGTH),
});
const existingRoomCalendarSourceSchema = roomCalendarSourceBaseSchema.extend({
  kind: z.literal("existing"),
  id: z.string().trim().min(1),
  name: z.string().trim().min(1, "연결 이름을 입력해 주세요.").max(CALENDAR_SOURCE_NAME_MAX_LENGTH),
  isActive: z.boolean(),
  markedForDeletion: z.boolean(),
});
const newRoomCalendarSourceSchema = roomCalendarSourceBaseSchema.extend({
  kind: z.literal("new"),
  isActive: z.literal(true),
});

export const roomWithCalendarSourcesUpdateSchema = roomInputSchema.extend({
  id: z.string().trim().min(1),
  sources: z.array(z.discriminatedUnion("kind", [existingRoomCalendarSourceSchema, newRoomCalendarSourceSchema])).max(50),
  listings: z.array(z.object({
    provider: z.enum(REVIEW_PROVIDER_TYPES),
    listingUrl: z.string().trim().max(ROOM_LISTING_URL_MAX_LENGTH),
  })).length(REVIEW_PROVIDER_TYPES.length).superRefine((listings, context) => {
    if (new Set(listings.map((listing) => listing.provider)).size !== REVIEW_PROVIDER_TYPES.length) {
      context.addIssue({ code: "custom", message: "숙소 링크 플랫폼 구성이 올바르지 않습니다." });
    }
  }),
});
