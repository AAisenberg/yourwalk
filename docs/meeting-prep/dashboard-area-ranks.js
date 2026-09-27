window.YOURWALK_AREA_RANKS = {
  "generated_at": "2026-09-21T10:20:25+00:00",
  "source": "pipeline/data/intermediate/segment_scores.parquet",
  "scoring_spec_version": "1.1.3",
  "scored_at": "2026-08-03T03:10:26.486466+00:00",
  "rule": "Length-weighted mean of score_eligible segments. Suburb and ward as tagged on Casey footpaths. Missing is not treated as zero. Dandenong is not eligible.",
  "honest_copy": "Suburb and ward as tagged on Casey footpaths. Hulls are schematic convex hulls of scored paths, not official locality boundaries.",
  "lga": {
    "day": 6.3,
    "night": 7.6,
    "acc": 75,
    "heat": 44,
    "light": 77,
    "segs": 27364,
    "length_km": 3640.4
  },
  "suburbs": [
    {
      "id": "cranbourne-north",
      "name": "Cranbourne North",
      "day": 5.7,
      "night": 7.6,
      "acc": 74,
      "heat": 31,
      "light": 79,
      "segs": 1438,
      "length_km": 206.7,
      "thin": false,
      "x": 371.6,
      "y": 262.8,
      "rx": 129.2,
      "ry": 17.8,
      "hull": "M465.9 277.8 L240.1 266.2 L218.4 260.5 L238.7 242.3 L475.8 257.4 L465.9 277.8 Z",
      "tagsDay": [
        "Heat and shade"
      ],
      "tagsNight": []
    },
    {
      "id": "narre-warren-south",
      "name": "Narre Warren South",
      "day": 5.8,
      "night": 7.6,
      "acc": 76,
      "heat": 32,
      "light": 78,
      "segs": 1727,
      "length_km": 219.0,
      "thin": false,
      "x": 373.9,
      "y": 235.2,
      "rx": 111.8,
      "ry": 34.9,
      "hull": "M475.5 257.0 L256.4 245.3 L318.5 187.4 L419.4 217.5 L479.9 251.1 L475.5 257.0 Z",
      "tagsDay": [
        "Heat and shade"
      ],
      "tagsNight": [
        "After dark"
      ]
    },
    {
      "id": "cranbourne",
      "name": "Cranbourne",
      "day": 5.9,
      "night": 7.3,
      "acc": 70,
      "heat": 43,
      "light": 78,
      "segs": 1756,
      "length_km": 228.2,
      "thin": false,
      "x": 274.5,
      "y": 298.2,
      "rx": 76.9,
      "ry": 34.2,
      "hull": "M325.8 334.8 L187.6 327.8 L240.1 266.3 L341.2 272.0 L325.8 334.8 Z",
      "tagsDay": [
        "Footpaths",
        "Heat and shade"
      ],
      "tagsNight": [
        "Footpaths"
      ]
    },
    {
      "id": "cranbourne-east",
      "name": "Cranbourne East",
      "day": 5.9,
      "night": 7.8,
      "acc": 78,
      "heat": 31,
      "light": 79,
      "segs": 1875,
      "length_km": 237.7,
      "thin": false,
      "x": 372.1,
      "y": 312.1,
      "rx": 58.9,
      "ry": 33.5,
      "hull": "M405.6 339.1 L326.3 331.1 L343.6 272.1 L437.8 277.0 L405.6 339.1 Z",
      "tagsDay": [
        "Heat and shade"
      ],
      "tagsNight": []
    },
    {
      "id": "cranbourne-south",
      "name": "Cranbourne South",
      "day": 6.0,
      "night": 6.1,
      "acc": 66,
      "heat": 50,
      "light": 54,
      "segs": 338,
      "length_km": 96.6,
      "thin": false,
      "x": 155.6,
      "y": 339.6,
      "rx": 83.1,
      "ry": 36.9,
      "hull": "M238.5 398.7 L116.8 358.7 L123.7 324.9 L186.4 328.3 L279.6 367.1 L238.5 398.7 Z",
      "tagsDay": [
        "Footpaths",
        "Heat and shade"
      ],
      "tagsNight": [
        "Footpaths",
        "After dark"
      ]
    },
    {
      "id": "devon-meadows",
      "name": "Devon Meadows",
      "day": 6.0,
      "night": 5.9,
      "acc": 67,
      "heat": 49,
      "light": 46,
      "segs": 90,
      "length_km": 46.8,
      "thin": false,
      "x": 370.0,
      "y": 380.9,
      "rx": 53.3,
      "ry": 20.3,
      "hull": "M309.3 410.1 L329.4 369.6 L416.0 374.2 L415.3 384.5 L355.5 404.9 L309.3 410.1 Z",
      "tagsDay": [
        "Footpaths",
        "Heat and shade"
      ],
      "tagsNight": [
        "Footpaths",
        "After dark"
      ]
    },
    {
      "id": "pearcedale",
      "name": "Pearcedale",
      "day": 6.0,
      "night": 6.2,
      "acc": 62,
      "heat": 56,
      "light": 62,
      "segs": 189,
      "length_km": 33.5,
      "thin": false,
      "x": 162.0,
      "y": 431.3,
      "rx": 112.4,
      "ry": 24.1,
      "hull": "M153.8 446.4 L96.5 438.1 L84.1 414.1 L221.8 398.1 L308.9 410.1 L294.2 438.9 L153.8 446.4 Z",
      "tagsDay": [
        "Footpaths"
      ],
      "tagsNight": [
        "Footpaths",
        "After dark"
      ]
    },
    {
      "id": "beaconsfield",
      "name": "Beaconsfield",
      "day": 6.1,
      "night": 7.6,
      "acc": 73,
      "heat": 44,
      "light": 81,
      "segs": 11,
      "length_km": 0.9,
      "thin": true,
      "x": 570.4,
      "y": 226.9,
      "rx": 18.0,
      "ry": 14.0,
      "hull": "M573.6 225.2 L567.2 227.3 L561.3 225.9 L573.6 225.2 Z",
      "tagsDay": [
        "Footpaths",
        "Heat and shade"
      ],
      "tagsNight": [
        "Footpaths"
      ]
    },
    {
      "id": "blind-bight",
      "name": "Blind Bight",
      "day": 6.1,
      "night": 6.7,
      "acc": 67,
      "heat": 52,
      "light": 67,
      "segs": 49,
      "length_km": 9.6,
      "thin": true,
      "x": 482.1,
      "y": 456.9,
      "rx": 27.8,
      "ry": 14.0,
      "hull": "M494.0 459.9 L449.9 459.0 L502.4 451.2 L494.0 459.9 Z",
      "tagsDay": [
        "Footpaths"
      ],
      "tagsNight": [
        "Footpaths",
        "After dark"
      ]
    },
    {
      "id": "narre-warren",
      "name": "Narre Warren",
      "day": 6.1,
      "night": 7.6,
      "acc": 74,
      "heat": 42,
      "light": 78,
      "segs": 1970,
      "length_km": 254.2,
      "thin": false,
      "x": 378.0,
      "y": 174.8,
      "rx": 71.5,
      "ry": 35.1,
      "hull": "M426.1 214.2 L365.9 212.7 L310.7 186.9 L301.6 167.7 L328.2 144.0 L432.3 152.9 L444.7 199.6 L426.1 214.2 Z",
      "tagsDay": [
        "Heat and shade"
      ],
      "tagsNight": []
    },
    {
      "id": "berwick",
      "name": "Berwick",
      "day": 6.3,
      "night": 7.7,
      "acc": 77,
      "heat": 42,
      "light": 79,
      "segs": 3844,
      "length_km": 459.9,
      "thin": false,
      "x": 502.9,
      "y": 217.4,
      "rx": 106.7,
      "ry": 56.7,
      "hull": "M604.8 263.8 L478.7 257.1 L430.0 231.5 L403.7 181.2 L426.2 150.4 L571.1 172.1 L617.0 254.6 L604.8 263.8 Z",
      "tagsDay": [
        "Heat and shade"
      ],
      "tagsNight": []
    },
    {
      "id": "cannons-creek",
      "name": "Cannons Creek",
      "day": 6.3,
      "night": 5.1,
      "acc": 54,
      "heat": 77,
      "light": 47,
      "segs": 11,
      "length_km": 2.2,
      "thin": true,
      "x": 404.7,
      "y": 451.5,
      "rx": 18.0,
      "ry": 14.0,
      "hull": "M389.9 457.8 L398.3 443.7 L398.5 443.7 L410.6 455.4 L389.9 457.8 Z",
      "tagsDay": [
        "Footpaths"
      ],
      "tagsNight": [
        "Footpaths",
        "After dark"
      ]
    },
    {
      "id": "clyde-north",
      "name": "Clyde North",
      "day": 6.3,
      "night": 7.9,
      "acc": 80,
      "heat": 38,
      "light": 77,
      "segs": 4032,
      "length_km": 512.0,
      "thin": false,
      "x": 531.3,
      "y": 294.4,
      "rx": 138.6,
      "ry": 35.6,
      "hull": "M618.6 328.8 L411.5 318.0 L416.9 301.5 L478.4 257.7 L606.3 263.7 L686.2 294.8 L686.8 304.8 L618.6 328.8 Z",
      "tagsDay": [
        "Heat and shade"
      ],
      "tagsNight": [
        "After dark"
      ]
    },
    {
      "id": "cranbourne-west",
      "name": "Cranbourne West",
      "day": 6.3,
      "night": 7.7,
      "acc": 75,
      "heat": 46,
      "light": 79,
      "segs": 1414,
      "length_km": 195.8,
      "thin": false,
      "x": 186.7,
      "y": 297.6,
      "rx": 65.7,
      "ry": 31.8,
      "hull": "M161.1 326.4 L127.4 318.1 L151.1 268.7 L169.1 262.8 L226.6 265.8 L258.9 277.8 L239.0 308.4 L161.1 326.4 Z",
      "tagsDay": [
        "Heat and shade"
      ],
      "tagsNight": []
    },
    {
      "id": "tooradin",
      "name": "Tooradin",
      "day": 6.4,
      "night": 7.3,
      "acc": 72,
      "heat": 52,
      "light": 75,
      "segs": 78,
      "length_km": 9.6,
      "thin": false,
      "x": 629.4,
      "y": 451.1,
      "rx": 58.6,
      "ry": 32.4,
      "hull": "M713.8 469.6 L618.0 460.3 L596.6 445.1 L623.8 404.9 L713.8 469.6 Z",
      "tagsDay": [
        "Footpaths"
      ],
      "tagsNight": [
        "Footpaths",
        "After dark"
      ]
    },
    {
      "id": "warneet",
      "name": "Warneet",
      "day": 6.4,
      "night": 5.9,
      "acc": 64,
      "heat": 64,
      "light": 53,
      "segs": 15,
      "length_km": 3.1,
      "thin": true,
      "x": 413.1,
      "y": 464.5,
      "rx": 35.9,
      "ry": 14.0,
      "hull": "M379.5 473.7 L401.4 463.3 L450.0 459.1 L438.4 462.1 L379.5 473.7 Z",
      "tagsDay": [
        "Footpaths"
      ],
      "tagsNight": [
        "Footpaths",
        "After dark"
      ]
    },
    {
      "id": "clyde",
      "name": "Clyde",
      "day": 6.5,
      "night": 7.9,
      "acc": 79,
      "heat": 42,
      "light": 78,
      "segs": 1510,
      "length_km": 174.3,
      "thin": false,
      "x": 501.3,
      "y": 331.7,
      "rx": 123.4,
      "ry": 15.8,
      "hull": "M611.8 350.1 L411.0 339.5 L385.9 332.6 L410.5 318.5 L632.6 330.2 L628.5 346.0 L611.8 350.1 Z",
      "tagsDay": [
        "Heat and shade"
      ],
      "tagsNight": []
    },
    {
      "id": "hampton-park",
      "name": "Hampton Park",
      "day": 6.5,
      "night": 7.4,
      "acc": 72,
      "heat": 54,
      "light": 78,
      "segs": 1331,
      "length_km": 174.9,
      "thin": false,
      "x": 241.1,
      "y": 202.0,
      "rx": 67.1,
      "ry": 33.4,
      "hull": "M256.4 245.3 L182.4 202.5 L189.3 178.6 L310.0 186.5 L299.6 226.2 L256.4 245.3 Z",
      "tagsDay": [
        "Footpaths"
      ],
      "tagsNight": [
        "Footpaths",
        "After dark"
      ]
    },
    {
      "id": "lynbrook",
      "name": "Lynbrook",
      "day": 6.5,
      "night": 7.6,
      "acc": 74,
      "heat": 53,
      "light": 80,
      "segs": 615,
      "length_km": 72.0,
      "thin": false,
      "x": 209.9,
      "y": 229.5,
      "rx": 32.5,
      "ry": 25.0,
      "hull": "M225.6 256.9 L175.3 222.0 L180.5 207.7 L239.9 215.1 L225.6 256.9 Z",
      "tagsDay": [
        "Footpaths"
      ],
      "tagsNight": [
        "Footpaths"
      ]
    },
    {
      "id": "lyndhurst",
      "name": "Lyndhurst",
      "day": 6.5,
      "night": 7.9,
      "acc": 78,
      "heat": 47,
      "light": 80,
      "segs": 546,
      "length_km": 83.3,
      "thin": false,
      "x": 185.5,
      "y": 250.1,
      "rx": 37.2,
      "ry": 20.2,
      "hull": "M228.6 265.2 L156.1 261.2 L172.4 224.7 L221.7 252.1 L228.6 265.2 Z",
      "tagsDay": [
        "Heat and shade"
      ],
      "tagsNight": []
    },
    {
      "id": "hallam",
      "name": "Hallam",
      "day": 6.7,
      "night": 7.6,
      "acc": 74,
      "heat": 56,
      "light": 79,
      "segs": 673,
      "length_km": 95.0,
      "thin": false,
      "x": 261.4,
      "y": 158.1,
      "rx": 61.6,
      "ry": 24.2,
      "hull": "M289.6 180.8 L206.0 168.3 L202.6 144.7 L279.2 132.4 L321.1 151.3 L289.6 180.8 Z",
      "tagsDay": [],
      "tagsNight": []
    },
    {
      "id": "botanic-ridge",
      "name": "Botanic Ridge",
      "day": 6.8,
      "night": 7.9,
      "acc": 79,
      "heat": 50,
      "light": 78,
      "segs": 696,
      "length_km": 95.0,
      "thin": false,
      "x": 251.7,
      "y": 355.9,
      "rx": 80.8,
      "ry": 20.5,
      "hull": "M324.0 369.1 L174.1 361.6 L187.0 328.1 L335.3 352.5 L324.0 369.1 Z",
      "tagsDay": [
        "Heat and shade"
      ],
      "tagsNight": []
    },
    {
      "id": "eumemmerring",
      "name": "Eumemmerring",
      "day": 6.8,
      "night": 7.5,
      "acc": 71,
      "heat": 62,
      "light": 79,
      "segs": 182,
      "length_km": 20.2,
      "thin": false,
      "x": 178.7,
      "y": 148.8,
      "rx": 27.2,
      "ry": 14.0,
      "hull": "M192.7 155.9 L143.5 153.5 L144.4 150.7 L189.4 140.3 L192.7 155.9 Z",
      "tagsDay": [
        "Footpaths"
      ],
      "tagsNight": [
        "Footpaths"
      ]
    },
    {
      "id": "harkaway",
      "name": "Harkaway",
      "day": 6.8,
      "night": 6.4,
      "acc": 65,
      "heat": 71,
      "light": 63,
      "segs": 21,
      "length_km": 4.0,
      "thin": true,
      "x": 511.5,
      "y": 155.3,
      "rx": 38.6,
      "ry": 14.0,
      "hull": "M473.5 165.0 L484.8 151.1 L514.3 146.2 L544.2 154.1 L527.7 163.7 L473.5 165.0 Z",
      "tagsDay": [
        "Footpaths"
      ],
      "tagsNight": [
        "Footpaths",
        "After dark"
      ]
    },
    {
      "id": "narre-warren-north",
      "name": "Narre Warren North",
      "day": 6.8,
      "night": 7.5,
      "acc": 74,
      "heat": 58,
      "light": 78,
      "segs": 357,
      "length_km": 61.3,
      "thin": false,
      "x": 390.6,
      "y": 136.4,
      "rx": 104.0,
      "ry": 30.6,
      "hull": "M447.0 158.3 L286.7 146.6 L277.2 136.8 L296.6 97.2 L445.3 107.2 L485.1 126.3 L447.0 158.3 Z",
      "tagsDay": [],
      "tagsNight": [
        "After dark"
      ]
    },
    {
      "id": "endeavour-hills",
      "name": "Endeavour Hills",
      "day": 6.9,
      "night": 7.6,
      "acc": 75,
      "heat": 60,
      "light": 78,
      "segs": 1771,
      "length_km": 236.7,
      "thin": false,
      "x": 224.0,
      "y": 118.1,
      "rx": 81.5,
      "ry": 28.5,
      "hull": "M221.0 144.7 L135.8 111.5 L135.2 100.8 L204.0 88.0 L298.0 94.0 L279.2 132.4 L259.4 142.4 L221.0 144.7 Z",
      "tagsDay": [],
      "tagsNight": []
    },
    {
      "id": "doveton",
      "name": "Doveton",
      "day": 7.0,
      "night": 7.6,
      "acc": 74,
      "heat": 64,
      "light": 81,
      "segs": 624,
      "length_km": 83.3,
      "thin": false,
      "x": 152.9,
      "y": 136.7,
      "rx": 41.5,
      "ry": 17.9,
      "hull": "M200.2 141.1 L123.6 152.4 L117.2 137.0 L142.9 117.4 L200.2 141.1 Z",
      "tagsDay": [
        "Footpaths"
      ],
      "tagsNight": [
        "Footpaths"
      ]
    },
    {
      "id": "junction-village",
      "name": "Junction Village",
      "day": 7.0,
      "night": 7.9,
      "acc": 81,
      "heat": 53,
      "light": 77,
      "segs": 164,
      "length_km": 19.0,
      "thin": false,
      "x": 321.8,
      "y": 344.1,
      "rx": 19.6,
      "ry": 14.0,
      "hull": "M335.8 352.7 L305.4 350.8 L311.7 334.2 L341.0 340.1 L335.8 352.7 Z",
      "tagsDay": [],
      "tagsNight": [
        "After dark"
      ]
    },
    {
      "id": "lysterfield-south",
      "name": "Lysterfield South",
      "day": 7.7,
      "night": 7.9,
      "acc": 86,
      "heat": 64,
      "light": 68,
      "segs": 37,
      "length_km": 5.6,
      "thin": true,
      "x": 271.5,
      "y": 90.6,
      "rx": 27.3,
      "ry": 14.0,
      "hull": "M298.1 93.8 L252.4 92.5 L247.5 90.0 L302.2 86.9 L298.1 93.8 Z",
      "tagsDay": [],
      "tagsNight": [
        "After dark"
      ]
    }
  ],
  "wards": [
    {
      "id": "correa",
      "name": "Correa",
      "day": 5.6,
      "night": 7.6,
      "acc": 73,
      "heat": 29,
      "light": 80,
      "segs": 2444,
      "length_km": 324.6,
      "thin": false,
      "x": 361.3,
      "y": 293.4,
      "rx": 113.0,
      "ry": 31.4,
      "hull": "M443.6 319.6 L300.2 311.9 L240.1 266.3 L262.9 256.9 L332.0 259.6 L466.0 283.1 L443.6 319.6 Z",
      "tagsDay": [
        "Footpaths",
        "Heat and shade"
      ],
      "tagsNight": [
        "Footpaths"
      ]
    },
    {
      "id": "kowan",
      "name": "Kowan",
      "day": 5.7,
      "night": 7.7,
      "acc": 77,
      "heat": 28,
      "light": 78,
      "segs": 2023,
      "length_km": 275.1,
      "thin": false,
      "x": 433.0,
      "y": 251.4,
      "rx": 89.2,
      "ry": 33.7,
      "hull": "M465.9 277.8 L344.0 271.4 L372.0 210.5 L426.2 214.2 L521.4 238.9 L465.9 277.8 Z",
      "tagsDay": [
        "Heat and shade"
      ],
      "tagsNight": [
        "After dark"
      ]
    },
    {
      "id": "casuarina",
      "name": "Casuarina",
      "day": 5.9,
      "night": 7.5,
      "acc": 73,
      "heat": 38,
      "light": 78,
      "segs": 2121,
      "length_km": 271.1,
      "thin": false,
      "x": 353.8,
      "y": 206.8,
      "rx": 110.3,
      "ry": 54.6,
      "hull": "M346.6 260.9 L245.1 245.3 L319.2 151.6 L465.6 209.1 L346.6 260.9 Z",
      "tagsDay": [
        "Footpaths",
        "Heat and shade"
      ],
      "tagsNight": [
        "Footpaths",
        "After dark"
      ]
    },
    {
      "id": "akoonah",
      "name": "Akoonah",
      "day": 6.2,
      "night": 7.7,
      "acc": 75,
      "heat": 43,
      "light": 80,
      "segs": 1927,
      "length_km": 242.4,
      "thin": false,
      "x": 507.7,
      "y": 217.5,
      "rx": 86.9,
      "ry": 41.3,
      "hull": "M544.5 250.2 L432.3 232.4 L417.5 221.7 L432.2 191.3 L510.0 168.5 L569.9 171.6 L586.7 188.4 L591.4 238.7 L544.5 250.2 Z",
      "tagsDay": [
        "Heat and shade"
      ],
      "tagsNight": []
    },
    {
      "id": "quarters",
      "name": "Quarters",
      "day": 6.3,
      "night": 7.6,
      "acc": 74,
      "heat": 46,
      "light": 80,
      "segs": 2250,
      "length_km": 320.5,
      "thin": false,
      "x": 204.5,
      "y": 283.0,
      "rx": 85.5,
      "ry": 45.4,
      "hull": "M298.9 311.8 L130.1 312.6 L172.6 224.7 L297.8 295.2 L301.2 306.6 L298.9 311.8 Z",
      "tagsDay": [
        "Footpaths"
      ],
      "tagsNight": [
        "Footpaths"
      ]
    },
    {
      "id": "cranbourne-gardens",
      "name": "Cranbourne Gardens",
      "day": 6.4,
      "night": 6.9,
      "acc": 72,
      "heat": 51,
      "light": 65,
      "segs": 2305,
      "length_km": 395.8,
      "thin": false,
      "x": 229.9,
      "y": 352.2,
      "rx": 210.7,
      "ry": 83.0,
      "hull": "M379.5 473.7 L96.5 438.1 L84.1 414.1 L131.7 311.2 L298.5 312.3 L416.0 374.2 L505.5 454.5 L379.5 473.7 Z",
      "tagsDay": [
        "Footpaths"
      ],
      "tagsNight": [
        "Footpaths",
        "After dark"
      ]
    },
    {
      "id": "dillwynia",
      "name": "Dillwynia",
      "day": 6.4,
      "night": 7.9,
      "acc": 80,
      "heat": 38,
      "light": 77,
      "segs": 3736,
      "length_km": 422.0,
      "thin": false,
      "x": 556.7,
      "y": 283.7,
      "rx": 113.6,
      "ry": 44.5,
      "hull": "M618.6 328.8 L495.0 322.3 L461.4 298.4 L478.1 257.9 L497.9 249.6 L588.6 239.9 L688.6 296.3 L686.8 304.8 L618.6 328.8 Z",
      "tagsDay": [
        "Heat and shade"
      ],
      "tagsNight": [
        "After dark"
      ]
    },
    {
      "id": "river-gum",
      "name": "River Gum",
      "day": 6.4,
      "night": 7.5,
      "acc": 72,
      "heat": 53,
      "light": 79,
      "segs": 1709,
      "length_km": 216.1,
      "thin": false,
      "x": 237.4,
      "y": 224.4,
      "rx": 69.3,
      "ry": 38.0,
      "hull": "M276.3 267.8 L239.0 266.1 L187.8 233.8 L175.0 221.4 L188.2 193.8 L313.6 195.3 L276.3 267.8 Z",
      "tagsDay": [
        "Footpaths"
      ],
      "tagsNight": [
        "Footpaths"
      ]
    },
    {
      "id": "tooradin",
      "name": "Tooradin",
      "day": 6.4,
      "night": 7.9,
      "acc": 79,
      "heat": 40,
      "light": 77,
      "segs": 2987,
      "length_km": 394.1,
      "thin": false,
      "x": 460.8,
      "y": 329.5,
      "rx": 206.9,
      "ry": 85.1,
      "hull": "M713.8 469.6 L618.0 460.2 L329.1 334.1 L300.0 312.3 L471.5 299.7 L632.6 330.2 L713.8 469.6 Z",
      "tagsDay": [
        "Heat and shade"
      ],
      "tagsNight": [
        "After dark"
      ]
    },
    {
      "id": "grevillea",
      "name": "Grevillea",
      "day": 6.5,
      "night": 7.7,
      "acc": 77,
      "heat": 47,
      "light": 79,
      "segs": 1927,
      "length_km": 245.2,
      "thin": false,
      "x": 431.2,
      "y": 163.5,
      "rx": 104.4,
      "ry": 43.9,
      "hull": "M505.8 195.0 L432.7 191.0 L335.5 151.7 L445.3 107.2 L544.2 154.1 L505.8 195.0 Z",
      "tagsDay": [],
      "tagsNight": []
    },
    {
      "id": "waratah",
      "name": "Waratah",
      "day": 6.8,
      "night": 7.5,
      "acc": 73,
      "heat": 60,
      "light": 79,
      "segs": 2012,
      "length_km": 271.4,
      "thin": false,
      "x": 209.9,
      "y": 158.3,
      "rx": 102.0,
      "ry": 45.2,
      "hull": "M246.3 201.8 L181.6 199.8 L123.6 152.4 L117.2 137.0 L135.8 111.5 L321.1 151.3 L309.7 187.0 L246.3 201.8 Z",
      "tagsDay": [
        "Footpaths"
      ],
      "tagsNight": [
        "Footpaths"
      ]
    },
    {
      "id": "kalora",
      "name": "Kalora",
      "day": 7.0,
      "night": 7.6,
      "acc": 75,
      "heat": 61,
      "light": 78,
      "segs": 1923,
      "length_km": 262.1,
      "thin": false,
      "x": 237.1,
      "y": 119.5,
      "rx": 135.1,
      "ry": 32.5,
      "hull": "M322.2 150.3 L225.1 141.3 L158.8 119.8 L135.2 100.8 L204.0 88.0 L302.2 86.9 L405.3 134.9 L322.2 150.3 Z",
      "tagsDay": [],
      "tagsNight": [
        "After dark"
      ]
    }
  ]
};
