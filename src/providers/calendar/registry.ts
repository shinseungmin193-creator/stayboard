import { AgodaProvider } from "./agoda-provider";
import { AirbnbProvider } from "./airbnb-provider";
import { BookingProvider } from "./booking-provider";
import type { CalendarProvider, CalendarProviderType } from "./types";
export class CalendarProviderRegistry { private readonly providers = new Map<CalendarProviderType, CalendarProvider>(); constructor(providers: readonly CalendarProvider[] = []) { providers.forEach((provider) => this.register(provider)); } register(provider: CalendarProvider): void { this.providers.set(provider.type, provider); } get(type: CalendarProviderType): CalendarProvider { const provider = this.providers.get(type); if (!provider) throw new Error(`등록되지 않은 캘린더 Provider입니다: ${type}`); return provider; } has(type: CalendarProviderType): boolean { return this.providers.has(type); } list(): readonly CalendarProvider[] { return [...this.providers.values()]; } }
export const calendarProviderRegistry = new CalendarProviderRegistry([new AirbnbProvider(), new BookingProvider(), new AgodaProvider()]);
