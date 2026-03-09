export function round2(n) {
  return Math.round(n * 100) / 100;
}

export function getFix(value, table) {
  const row = table.find((item) => value >= item.from && value < item.to);
  return row ? row.price : 0;
}

export function createCalculator(config) {
  function calcMMRBoost(from, to, doubles) {
    let base = 0;
    for (const row of config.mmr) {
      const start = Math.max(from, row.from);
      const end = Math.min(to, row.to);
      if (end > start) {
        base += ((end - start) / 100) * row.price;
      }
    }
    let booster = base;
    if (doubles) {
      booster *= from < 7700 ? config.modifiers.mmrDoublesUnder7700 : config.modifiers.mmrDoublesOver7700;
    }
    return { fix: Math.round(base), booster: Math.round(booster) };
  }

  function calcPartyBoost(mmr, wins, doubles) {
    const basePerWin = getFix(mmr, config.party);
    const base = basePerWin * wins;
    let booster = base;
    if (doubles) {
      if (mmr < 5620) booster = base * config.modifiers.partyDoublesUnder5620;
      else if (mmr < 7000) booster = base * config.modifiers.partyDoubles5620to7000;
      else if (mmr < 8500) booster = config.modifiers.partyDoubles7000to8500 * wins;
    }
    return { fix: Math.round(base), booster: Math.round(booster) };
  }

  function calcCalibrationTransfer(mmr, wins) {
    const perWin = getFix(mmr, config.calibration);
    const base = perWin * wins;
    return { fix: Math.round(base), booster: Math.round(base) };
  }

  function calcLowPriority(mmr, lpCount, partyWithClient) {
    const perLp = getFix(mmr, config.lp);
    const base = perLp * lpCount;
    const booster = partyWithClient ? base * config.modifiers.lpPartyMultiplier : base;
    return { fix: Math.round(base), booster: Math.round(booster) };
  }

  function calcBehavior(fromScore, toScore, highMmrAccount) {
    const delta = Math.max(0, toScore - fromScore);
    let per1000 = config.behavior.from9000;
    if (fromScore < 5000) per1000 = config.behavior.under5000;
    else if (fromScore < 9000) per1000 = config.behavior.under9000;
    const base = (delta / 1000) * per1000;
    const booster = highMmrAccount ? base * config.behavior.highMmrAccountMultiplier : base;
    return { fix: Math.round(base), booster: Math.round(booster) };
  }

  function calculate(data) {
    let fix = 0;
    let booster = 0;

    if (data.type === 'mmr') ({ fix, booster } = calcMMRBoost(data.from, data.to, data.doubles));
    if (data.type === 'party') ({ fix, booster } = calcPartyBoost(data.from, data.to, data.doubles));
    if (data.type === 'calib') ({ fix, booster } = calcCalibrationTransfer(data.from, data.to));
    if (data.type === 'lp') ({ fix, booster } = calcLowPriority(data.from, data.to, data.partyWithClient));
    if (data.type === 'behavior') ({ fix, booster } = calcBehavior(data.from, data.to, data.highMmrAccount));

    if (data.lowConfidence && data.type === 'party') {
      booster *= config.modifiers.lowConfidence;
    }

    booster = Math.round(booster);
    const coeff = config.fanpay.coeffs[data.category] ?? config.fanpay.coeffs.boost;
    const feeTotal = booster * (coeff - 1);
    const feeMine = feeTotal * config.fanpay.split;
    const cost = booster + feeMine;
    const boosterPayout = booster + feeMine;
    const client = cost * (1 + data.margin);

    return {
      fix: Math.round(fix),
      booster: Math.round(booster),
      boosterPayout: Math.round(boosterPayout),
      client: Math.round(client),
      profit: Math.round(client - cost),
      coeff: round2(coeff),
    };
  }

  return { config, calculate };
}

export function calcFanPaySplit(sum, config) {
  const result = {};
  for (const [key, coeff] of Object.entries(config.fanpay.coeffs)) {
    result[key] = {
      coeff: round2(coeff),
      buyer100: round2(sum * coeff),
      list5050: round2(sum * (1 + (coeff - 1) * config.fanpay.split)),
    };
  }
  return result;
}
