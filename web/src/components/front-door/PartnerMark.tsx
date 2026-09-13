/**
 * Partner well artwork. CrowdLab uses the marketing lockup (mark + word).
 * Monash + XYX Lab stay one lockup: official Monash mark over official XYX word.
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
          width={32}
          height={32}
          className="h-8 w-8 shrink-0"
        />
        <span className="text-[20px] font-extrabold tracking-tight text-black">
          CrowdLab
        </span>
      </span>
    );
  }

  if (org.src && org.srcSecondary) {
    return (
      <span className="flex w-full flex-col items-center justify-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={org.src}
          alt=""
          className="max-h-10 max-w-[88%] object-contain"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={org.srcSecondary}
          alt=""
          className="max-h-7 max-w-[88%] object-contain"
        />
      </span>
    );
  }

  if (org.src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={org.src}
        alt=""
        className="max-h-14 max-w-[80%] object-contain"
      />
    );
  }

  return (
    <span className="text-[16px] font-extrabold tracking-tight text-yw-navy">
      {org.name}
    </span>
  );
}
