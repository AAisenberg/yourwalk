/**
 * Partner well artwork. CrowdLab uses the marketing lockup (mark + word).
 * Monash + XYX Lab stay one lockup: official marks side by side.
 */

type PartnerOrg = {
  id: string;
  name: string;
  src: string | null;
  srcSecondary?: string | null;
};

export function PartnerMark({ org }: { org: PartnerOrg }) {
  if (org.id === "crowdlab" && org.src) {
    return (
      <span className="inline-flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={org.src}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 shrink-0"
        />
        <span className="text-[22px] font-extrabold leading-none tracking-tight text-black sm:text-2xl">
          CrowdLab
        </span>
      </span>
    );
  }

  if (org.src && org.srcSecondary) {
    return (
      <span className="flex w-full items-center justify-center gap-3 sm:gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={org.src}
          alt="Monash University"
          className="h-9 w-auto max-w-[46%] object-contain sm:h-10"
        />
        <span
          className="h-8 w-px shrink-0 bg-slate-200"
          aria-hidden
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={org.srcSecondary}
          alt="XYX Lab"
          className="h-8 w-auto max-w-[46%] object-contain sm:h-9"
        />
      </span>
    );
  }

  if (org.src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={org.src}
        alt={org.name}
        className="max-h-10 max-w-[80%] object-contain"
      />
    );
  }

  return (
    <span className="text-[16px] font-extrabold tracking-tight text-yw-navy">
      {org.name}
    </span>
  );
}
