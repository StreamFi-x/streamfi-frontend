import { NextRequest, NextResponse } from "next/server";

type DMS = {
  degrees: number;
  minutes: number;
  seconds: number;
  direction: string;
};

export async function POST(req: NextRequest) {
  let body: {
    mode?: unknown;
    dms?: Partial<DMS>;
    decimal?: unknown;
    type?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { mode, dms, decimal, type } = body;

  if (mode !== "to_decimal" && mode !== "to_dms") {
    return NextResponse.json(
      { error: "mode must be either 'to_decimal' or 'to_dms'." },
      { status: 400 }
    );
  }

  if (type !== undefined && type !== "lat" && type !== "lng") {
    return NextResponse.json(
      { error: "type must be either 'lat' or 'lng' if provided." },
      { status: 400 }
    );
  }

  if (mode === "to_decimal") {
    if (dms === undefined || typeof dms !== "object" || dms === null) {
      return NextResponse.json(
        { error: "dms object is required for to_decimal mode." },
        { status: 400 }
      );
    }

    const degrees = Number(dms.degrees);
    const minutes = Number(dms.minutes);
    const seconds = Number(dms.seconds);
    const direction = dms.direction;

    if (
      dms.degrees === undefined ||
      dms.minutes === undefined ||
      dms.seconds === undefined ||
      direction === undefined ||
      isNaN(degrees) ||
      isNaN(minutes) ||
      isNaN(seconds) ||
      typeof direction !== "string"
    ) {
      return NextResponse.json(
        { error: "dms must contain degrees, minutes, seconds as numbers, and direction as a string." },
        { status: 400 }
      );
    }

    const dirUpper = direction.trim().toUpperCase();
    if (!["N", "S", "E", "W"].includes(dirUpper)) {
      return NextResponse.json(
        { error: "direction must be 'N', 'S', 'E', or 'W'." },
        { status: 400 }
      );
    }

    if (degrees < 0 || minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) {
      return NextResponse.json(
        { error: "degrees/minutes/seconds must be positive, with minutes and seconds less than 60." },
        { status: 400 }
      );
    }

    // Determine type from direction if type is not provided
    const resolvedType = type || (["N", "S"].includes(dirUpper) ? "lat" : "lng");

    if (resolvedType === "lat" && !["N", "S"].includes(dirUpper)) {
      return NextResponse.json(
        { error: "Latitude direction must be 'N' or 'S'." },
        { status: 400 }
      );
    }

    if (resolvedType === "lng" && !["E", "W"].includes(dirUpper)) {
      return NextResponse.json(
        { error: "Longitude direction must be 'E' or 'W'." },
        { status: 400 }
      );
    }

    let decimalVal = degrees + minutes / 60 + seconds / 3600;
    if (dirUpper === "S" || dirUpper === "W") {
      decimalVal = -decimalVal;
    }

    // Validate range limits
    if (resolvedType === "lat" && (decimalVal < -90 || decimalVal > 90)) {
      return NextResponse.json(
        { error: "Latitude decimal degrees must be between -90 and 90." },
        { status: 400 }
      );
    }

    if (resolvedType === "lng" && (decimalVal < -180 || decimalVal > 180)) {
      return NextResponse.json(
        { error: "Longitude decimal degrees must be between -180 and 180." },
        { status: 400 }
      );
    }

    return NextResponse.json({ decimal: decimalVal });
  } else {
    // mode === 'to_dms'
    if (decimal === undefined || isNaN(Number(decimal)) || typeof decimal === "boolean") {
      return NextResponse.json(
        { error: "decimal is required and must be a number for to_dms mode." },
        { status: 400 }
      );
    }

    const decimalVal = Number(decimal);

    // Resolve type: default to lat unless out of lat bounds, or type is specified
    const resolvedType = type || (Math.abs(decimalVal) > 90 ? "lng" : "lat");

    // Validate range limits
    if (resolvedType === "lat" && (decimalVal < -90 || decimalVal > 90)) {
      return NextResponse.json(
        { error: "Latitude decimal degrees must be between -90 and 90." },
        { status: 400 }
      );
    }

    if (resolvedType === "lng" && (decimalVal < -180 || decimalVal > 180)) {
      return NextResponse.json(
        { error: "Longitude decimal degrees must be between -180 and 180." },
        { status: 400 }
      );
    }

    const absVal = Math.abs(decimalVal);
    const degrees = Math.floor(absVal);
    const minutesDecimal = (absVal - degrees) * 60;
    const minutes = Math.floor(minutesDecimal);
    let seconds = (minutesDecimal - minutes) * 60;

    // Handle numerical precision, round to 4 decimal places
    seconds = Math.round(seconds * 10000) / 10000;
    let minutesVal = minutes;
    let degreesVal = degrees;

    if (seconds >= 60) {
      seconds = 0;
      minutesVal += 1;
    }
    if (minutesVal >= 60) {
      minutesVal = 0;
      degreesVal += 1;
    }

    let direction = "";
    if (resolvedType === "lat") {
      direction = decimalVal >= 0 ? "N" : "S";
    } else {
      direction = decimalVal >= 0 ? "E" : "W";
    }

    return NextResponse.json({
      degrees: degreesVal,
      minutes: minutesVal,
      seconds,
      direction,
    });
  }
}
