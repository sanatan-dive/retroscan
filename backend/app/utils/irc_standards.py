"""IRC 67 and IRC 35 retroreflectivity standards and compliance checking."""

from typing import Optional

# IRC 67: Retroreflectivity for Traffic Signs (cd/lux/m²)
# Minimum RA values by sheeting type and color
SIGN_STANDARDS = {
    "type_i": {
        "name": "Engineering Grade",
        "white": 70,
        "yellow": 50,
        "red": 14.5,
        "green": 9,
        "blue": 4,
        "orange": 25,
    },
    "type_iii": {
        "name": "High Intensity Prismatic",
        "white": 120,
        "yellow": 85,
        "red": 25,
        "green": 15,
        "blue": 8,
        "orange": 60,
    },
    "type_ix": {
        "name": "Diamond Grade",
        "white": 250,
        "yellow": 170,
        "red": 45,
        "green": 25,
        "blue": 15,
        "orange": 100,
    },
}

# IRC 35: Retroreflectivity for Road Markings (mcd/m²/lux)
MARKING_STANDARDS = {
    "white": {"new": 150, "maintained": 100},
    "yellow": {"new": 100, "maintained": 80},
}

# Road stud minimum retroreflectivity (mcd/lux)
STUD_STANDARDS = {
    "white": 100,
    "yellow": 70,
    "red": 50,
}


def check_sign_compliance(
    retro_score: float,
    sheeting_type: str = "type_iii",
    color: str = "white",
) -> dict:
    """Check if a sign meets IRC 67 minimum retroreflectivity."""
    standard = SIGN_STANDARDS.get(sheeting_type, SIGN_STANDARDS["type_iii"])
    threshold = standard.get(color, standard["white"])
    # Map our 0-100 score to approximate RA value
    # Score 100 = new sign (~300 cd/lux/m²), Score 0 = completely degraded
    estimated_ra = retro_score * 3.0

    return {
        "standard": "IRC 67",
        "sheeting_type": standard["name"],
        "color": color,
        "estimated_ra": round(estimated_ra, 1),
        "threshold": threshold,
        "unit": "cd/lux/m²",
        "compliant": estimated_ra >= threshold,
        "margin": round(estimated_ra - threshold, 1),
        "recommendation": _sign_recommendation(estimated_ra, threshold),
    }


def check_marking_compliance(
    retro_score: float,
    color: str = "white",
    condition: str = "maintained",
) -> dict:
    """Check if a road marking meets IRC 35 minimum retroreflectivity."""
    standards = MARKING_STANDARDS.get(color, MARKING_STANDARDS["white"])
    threshold = standards.get(condition, standards["maintained"])
    # Map 0-100 score to approximate RL value
    # Score 100 = new marking (~250 mcd/m²/lux), Score 0 = gone
    estimated_rl = retro_score * 2.5

    return {
        "standard": "IRC 35",
        "color": color,
        "condition": condition,
        "estimated_rl": round(estimated_rl, 1),
        "threshold": threshold,
        "unit": "mcd/m²/lux",
        "compliant": estimated_rl >= threshold,
        "margin": round(estimated_rl - threshold, 1),
        "recommendation": _marking_recommendation(estimated_rl, threshold),
    }


def check_stud_compliance(
    retro_score: float,
    color: str = "white",
) -> dict:
    """Check road stud retroreflectivity compliance."""
    threshold = STUD_STANDARDS.get(color, STUD_STANDARDS["white"])
    estimated_value = retro_score * 1.5

    return {
        "standard": "IRC SP:79",
        "color": color,
        "estimated_value": round(estimated_value, 1),
        "threshold": threshold,
        "unit": "mcd/lux",
        "compliant": estimated_value >= threshold,
        "margin": round(estimated_value - threshold, 1),
        "recommendation": _stud_recommendation(estimated_value, threshold),
    }


def _sign_recommendation(value: float, threshold: float) -> str:
    ratio = value / threshold if threshold > 0 else 0
    if ratio >= 1.5:
        return "Sign in excellent condition. No action needed."
    elif ratio >= 1.0:
        return "Sign meets minimum standards. Schedule inspection in 6 months."
    elif ratio >= 0.7:
        return "Sign approaching non-compliance. Plan replacement within 3 months."
    else:
        return "Sign is non-compliant. Immediate replacement required."


def _marking_recommendation(value: float, threshold: float) -> str:
    ratio = value / threshold if threshold > 0 else 0
    if ratio >= 1.5:
        return "Marking in excellent condition. No action needed."
    elif ratio >= 1.0:
        return "Marking meets minimum standards. Re-inspect in 3 months."
    elif ratio >= 0.7:
        return "Marking fading. Schedule repainting within 2 months."
    else:
        return "Marking non-compliant. Immediate repainting required."


def _stud_recommendation(value: float, threshold: float) -> str:
    ratio = value / threshold if threshold > 0 else 0
    if ratio >= 1.5:
        return "Road stud in good condition."
    elif ratio >= 1.0:
        return "Road stud meets standards. Re-inspect in 6 months."
    elif ratio >= 0.7:
        return "Road stud degrading. Plan replacement."
    else:
        return "Road stud non-compliant. Replace immediately."
