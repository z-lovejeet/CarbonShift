import { freezeDomain } from "@/domain/method";
import { referenceProfileSchema, type ReferenceProfileV2 } from "@/domain/activities/schemas";

/** Reviewed reference scenarios, never automatic claims about a user's device. */
export const ACTIVITY_PROFILES: readonly ReferenceProfileV2[] = freezeDomain([
  {
    id: "bosch-wge03408gb-eco-label", version: 1, category: "washing", title: "Bosch WGE03408GB · Eco 40–60 label average", model: "WGE03408GB",
    basis: { kind: "cycle", energyMwh: 460000 },
    sourceUrl: "https://media3.bosch-home.com/Documents/specsheet/en-GB/WGE03408GB.pdf",
    sourceTitle: "Bosch WGE03408GB product specification", reviewedOn: "2026-10-23",
    conditions: "Weighted label value of 46 kWh per 100 Eco 40–60 cycles, divided by 100. This is a rounded programme average, not the energy of every load. Enter your actual programme duration; energy is assumed uniform during that duration.",
  },
  {
    id: "samsung-ue50ru7455u-on", version: 1, category: "television", title: "Samsung UE50RU7455U · declared on-mode power", model: "UE50RU7455U",
    basis: { kind: "power", powerMw: 91000, rating: "average" },
    sourceUrl: "https://eprel.ec.europa.eu/screen/product/televisions/7944",
    sourceTitle: "EU EPREL supplier declaration · Samsung UE50RU7455U", reviewedOn: "2026-10-23",
    conditions: "Supplier-declared on-mode consumption of 91 W under the listed television test conditions. Your settings and content can change consumption. This reference does not include standby time or identify other TV models.",
  },
  {
    id: "philips-fc9744-09r1-max", version: 1, category: "vacuuming", title: "Philips FC9744/09R1 · maximum-power scenario", model: "FC9744/09R1",
    basis: { kind: "power", powerMw: 900000, rating: "maximum" },
    sourceUrl: "https://www.philips.com/c-p/FC9744_09R1/powerpro-expert-bagless-vacuum-cleaner",
    sourceTitle: "Philips PowerPro Expert FC9744/09R1 technical specifications", reviewedOn: "2026-10-23",
    conditions: "Maximum input power 900 W, with electronic power control. This models active runtime at that rating; it is not measured average use and may overestimate a lower setting.",
  },
  {
    id: "kaercher-k2-1673600-rated", version: 1, category: "car_cleaning", title: "Kärcher K 2 Power Control · connected-load scenario", model: "1.673-600.0",
    basis: { kind: "power", powerMw: 1400000, rating: "rated" },
    sourceUrl: "https://s1.kaercher-media.com/documents/datasheets/machines/en_INT/1.673-600.0_PI_en_INT.pdf",
    sourceTitle: "Kärcher K 2 Power Control technical data", reviewedOn: "2026-10-23",
    conditions: "Connected load 1.4 kW. Model only active motor runtime at this rating, not the full time spent cleaning. Follow the equipment instructions for the surface. Water, detergent and other lifecycle effects are excluded.",
  },
].map((record) => referenceProfileSchema.parse(record)));
