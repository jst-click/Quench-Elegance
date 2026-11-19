"""Hair & Scalp Health — Client Consultation Form.

Single source of truth for the consultation: the storefront registration wizard and the admin
panel both render from FORM (served by the API), and the backend validates submissions against it.

Section "audience":
  client      — answered by the customer while registering (sections 1–10 and 14)
  consultant  — filled by the Quench Elegance consultant in the admin panel (details, 11–13)

Field types: text, email, tel, date, number, textarea, single (radio), multi (checkboxes),
consent (single required tick), progress (initial / follow-up table), products (live catalogue).
Options listed in "exclusive" clear every other choice when picked (e.g. "None").
"other": True shows a free-text box when "Other" is picked (stored as "<id>Other").
"followUp" shows a text box when the answer equals followUp["when"] (stored as followUp["id"]).
"""
import re
from datetime import datetime, timezone

from .utils import ApiError, clip, normalize_phone

YES_NO = ["Yes", "No"]
YES_NO_NA = ["Yes", "No", "Not applicable"]


def f(id, label, type="single", **kw):
    return {"id": id, "label": label, "type": type, **kw}


FORM = [
    {
        "id": "details", "number": 0, "title": "Consultation details", "audience": "consultant",
        "subtitle": "Recorded by the consultant.",
        "fields": [
            f("consultationDate", "Consultation date", "date", half=True),
            f("consultantName", "Consultant name", "text", half=True),
            f("visitType", "Consultation type", options=["First consultation", "Follow-up"]),
        ],
    },
    {
        "id": "personal", "number": 1, "title": "Personal information", "audience": "client", "required": True,
        "subtitle": "So we can identify you and reach you about your consultation.",
        "fields": [
            f("fullName", "Full name", "text", required=True),
            f("age", "Age", "number", required=True, half=True, min=1, max=120),
            f("dob", "Date of birth", "date", half=True),
            f("gender", "Gender", options=["Male", "Female", "Other"], required=True),
            f("mobile", "Mobile number", "tel", required=True, half=True),
            f("whatsapp", "WhatsApp number", "tel", half=True, placeholder="If different from mobile"),
            f("email", "Email address", "email", half=True),
            f("occupation", "Occupation", "text", half=True),
            f("city", "City / location", "text", required=True, half=True),
            f("maritalStatus", "Marital status", options=["Single", "Married", "Prefer not to say"]),
        ],
    },
    {
        "id": "concerns", "number": 2, "title": "Primary hair concerns", "audience": "client", "required": True,
        "subtitle": "Tell us what's bothering you most about your hair and scalp.",
        "fields": [
            f("primaryConcerns", "What are your primary hair concerns?", "multi", required=True, other=True, options=[
                "Excessive hair fall", "Hair thinning", "Receding hairline", "Bald patches", "Reduced hair density",
                "Slow hair growth", "Dandruff", "Dry scalp", "Oily scalp", "Itchy scalp", "Scalp irritation",
                "Hair breakage", "Premature greying", "Frizzy hair", "Other"]),
            f("duration", "How long have you been experiencing this concern?", required=True, options=[
                "Less than 3 months", "3–6 months", "6–12 months", "1–3 years", "More than 3 years"]),
            f("hairFallLevel", "How would you describe your current hair fall?", options=[
                "Mild", "Moderate", "Severe", "Sudden increase in hair fall"]),
            f("affectedArea", "Which area is most affected?", "multi", options=[
                "Front hairline", "Crown area", "Top of the scalp", "Both temples", "Entire scalp", "Patchy hair loss"]),
            f("hairFallWhen", "When do you notice more hair fall?", "multi", options=[
                "While combing", "During hair wash", "While applying oil", "Throughout the day", "While sleeping"]),
        ],
    },
    {
        "id": "history", "number": 3, "title": "Hair & scalp history", "audience": "client",
        "subtitle": "Your hair's background helps us understand the pattern.",
        "fields": [
            f("previousHairLoss", "Have you experienced hair loss previously?", options=YES_NO),
            f("lossPattern", "Is your hair loss continuous or occasional?", options=["Continuous", "Occasional", "Seasonal"]),
            f("densityReduced", "Has your hair density reduced?", options=["Yes", "No", "Not sure"]),
            f("textureChanged", "Have you noticed changes in your hair texture?", options=YES_NO),
            f("hairType", "What is your natural hair type?", options=["Straight", "Wavy", "Curly", "Coily"]),
            f("hairThickness", "How would you describe your hair?", options=["Thin", "Medium", "Thick"]),
            f("familyHistory", "Has anyone in your family experienced hair loss?", "multi",
              options=["Father", "Mother", "Brother / Sister", "Grandparents", "No family history", "Not sure"],
              exclusive=["No family history", "Not sure"]),
        ],
    },
    {
        "id": "scalp", "number": 4, "title": "Scalp condition", "audience": "client",
        "subtitle": "A healthy-looking head of hair starts at the scalp.",
        "fields": [
            f("scalpType", "How would you describe your scalp?", options=["Normal", "Dry", "Oily", "Combination", "Sensitive"]),
            f("scalpSymptoms", "Do you experience any of the following?", "multi", options=[
                "Dandruff", "Itching", "Redness", "Flaking", "Excess oil production", "Scalp odour",
                "Burning sensation", "Scalp tenderness", "None"], exclusive=["None"]),
            f("washFrequency", "How frequently do you wash your hair?", options=[
                "Daily", "Alternate days", "Twice a week", "Once a week", "Less frequently"]),
            f("buildup", "Do you notice scalp buildup?", options=["Yes", "No", "Not sure"]),
            f("scalpInfection", "Have you had scalp infections or any diagnosed scalp condition?", options=YES_NO,
              followUp={"when": "Yes", "id": "scalpInfectionDetails", "label": "Please mention the condition"}),
        ],
    },
    {
        "id": "medical", "number": 5, "title": "Medical history", "audience": "client", "required": True,
        "subtitle": "Some health factors affect hair. This stays confidential.",
        "fields": [
            f("conditions", "Do you have any diagnosed medical conditions?", "multi", required=True, other=True, options=[
                "Thyroid disorders", "PCOS / PCOD", "Diabetes", "Anaemia", "Hormonal imbalance",
                "Autoimmune conditions", "Other", "None"], exclusive=["None"]),
            f("medication", "Are you currently taking any medication?", options=YES_NO, required=True,
              followUp={"when": "Yes", "id": "medicationDetails", "label": "Please mention the medication"}),
            f("surgery", "Have you undergone any major surgery?", options=YES_NO),
            f("recentIllness", "Have you had a recent fever, illness or hospitalisation?", options=YES_NO),
            f("recentStress", "Have you experienced significant physical or emotional stress recently?", options=YES_NO),
            f("previousTreatments", "Have you undergone any previous hair treatments?", "multi", required=True, other=True, options=[
                "PRP", "GFC", "Hair transplant", "Mesotherapy", "Laser treatment", "Other", "None"], exclusive=["None"]),
        ],
    },
    {
        "id": "nutrition", "number": 6, "title": "Nutrition & diet", "audience": "client",
        "subtitle": "What you eat shows up in your hair.",
        "fields": [
            f("diet", "What is your dietary preference?", options=["Vegetarian", "Non-vegetarian", "Eggetarian", "Vegan"]),
            f("protein", "How often do you eat protein-rich foods?", options=["Daily", "3–4 times a week", "Occasionally", "Rarely"]),
            f("water", "How much water do you drink daily?", options=["Less than 1 litre", "1–2 litres", "2–3 litres", "More than 3 litres"]),
            f("fruitsVeg", "Do you regularly eat fruits and vegetables?", options=["Yes", "No", "Occasionally"]),
            f("supplements", "Do you take nutritional supplements?", "multi", other=True, options=[
                "Biotin", "Vitamin D", "Vitamin B12", "Iron", "Zinc", "Multivitamins", "Protein supplements", "Other", "None"],
              exclusive=["None"]),
            f("deficiencies", "Have you been diagnosed with any nutritional deficiencies?", "multi", other=True, options=[
                "Iron deficiency", "Vitamin D deficiency", "Vitamin B12 deficiency", "Protein deficiency", "Other", "Not sure", "None"],
              exclusive=["Not sure", "None"]),
        ],
    },
    {
        "id": "lifestyle", "number": 7, "title": "Lifestyle & daily routine", "audience": "client",
        "subtitle": "Sleep, stress and habits all play a part.",
        "fields": [
            f("sleep", "Average sleep duration", options=["Less than 5 hours", "5–6 hours", "6–8 hours", "More than 8 hours"]),
            f("stressLevel", "How would you rate your stress level?", options=["Low", "Moderate", "High", "Very high"]),
            f("exercise", "Do you exercise regularly?", options=["Daily", "3–4 times a week", "Occasionally", "Never"]),
            f("smoke", "Do you smoke?", options=YES_NO),
            f("alcohol", "Do you consume alcohol?", options=["Yes", "No", "Occasionally"]),
            f("irregularSleep", "Do you have irregular sleeping habits?", options=YES_NO),
            f("sunExposure", "Do you spend long periods outdoors in sunlight?", options=YES_NO),
        ],
    },
    {
        "id": "routine", "number": 8, "title": "Current hair-care routine", "audience": "client",
        "subtitle": "What you use today helps us recommend what comes next.",
        "fields": [
            f("shampoo", "Which shampoo do you currently use?", "text", half=True),
            f("conditioner", "Which conditioner do you use?", "text", half=True),
            f("hairOil", "Do you regularly apply hair oil?", options=["Yes", "No", "Occasionally"]),
            f("hairSerum", "Do you use hair serum?", options=YES_NO),
            f("heatTools", "Do you use heat-styling tools?", "multi", options=["Hair dryer", "Straightener", "Curler", "None"], exclusive=["None"]),
            f("chemicalTreatments", "Have you had chemical hair treatments?", "multi", options=[
                "Hair colouring", "Smoothening", "Keratin", "Rebonding", "Perming", "None"], exclusive=["None"]),
            f("productSwitching", "Do you change hair-care products frequently?", options=YES_NO),
            f("adverseReactions", "Have you had any adverse reactions to hair-care products?", options=YES_NO,
              followUp={"when": "Yes", "id": "adverseReactionDetails", "label": "What reaction, and to which product?"}),
        ],
    },
    {
        "id": "womens", "number": 9, "title": "Women's health", "audience": "client",
        "subtitle": "Only where applicable — hormones have a strong effect on hair.",
        "condition": {"section": "personal", "field": "gender", "notIn": ["Male"]},
        "fields": [
            f("cyclesRegular", "Are your menstrual cycles regular?", options=YES_NO_NA),
            f("pregnant", "Are you currently pregnant?", options=YES_NO_NA),
            f("breastfeeding", "Are you breastfeeding?", options=YES_NO_NA),
            f("postpartum", "Have you experienced hair fall after childbirth?", options=YES_NO_NA),
            f("menopause", "Are you experiencing menopause-related changes?", options=YES_NO_NA),
            f("pcos", "Have you been diagnosed with PCOS / PCOD?", options=YES_NO),
        ],
    },
    {
        "id": "expectations", "number": 10, "title": "Your expectations", "audience": "client",
        "subtitle": "What would you like to achieve?",
        "fields": [
            f("goals", "What are your primary goals?", "multi", options=[
                "Improve the appearance of hair density", "Reduce hair breakage", "Improve scalp comfort",
                "Manage visible dandruff", "Improve hair texture", "Maintain healthy hair", "Establish a consistent hair-care routine"]),
            f("triedProducts", "Have you previously tried any hair-care products?", options=YES_NO),
            f("satisfied", "Were you satisfied with the results?", options=["Yes", "No", "Partially"]),
            f("timeline", "What is your expected timeline for improvement?", options=["1 month", "3 months", "6 months", "Long-term maintenance"]),
            f("willingRoutine", "Are you willing to follow a consistent hair-care routine?", options=["Yes", "No", "Need guidance"]),
        ],
    },
    {
        "id": "assessment", "number": 11, "title": "Professional hair & scalp assessment", "audience": "consultant",
        "subtitle": "Consultant use only — visual assessment.",
        "fields": [
            f("density", "Hair density", options=["Low", "Medium", "High"], half=True),
            f("shaftThickness", "Hair shaft thickness", options=["Fine", "Medium", "Coarse"], half=True),
            f("scalpVisibility", "Scalp visibility", options=["Normal", "Increased"], half=True),
            f("hairline", "Hairline", options=["Normal", "Receding"], half=True),
            f("scalpCondition", "Scalp condition", options=["Normal", "Dry", "Oily", "Flaky"], half=True),
            f("breakage", "Visible breakage", options=YES_NO, half=True),
            f("inflammation", "Visible inflammation", options=YES_NO, half=True),
            f("patches", "Visible patches", options=YES_NO, half=True),
            f("observations", "Assessment observations", "textarea"),
            f("photos", "Photographic documentation", "multi", options=["Front view", "Left side", "Right side", "Crown view", "Back view"]),
        ],
    },
    {
        "id": "recommendation", "number": 12, "title": "Personalised hair-care recommendation", "audience": "consultant",
        "subtitle": "Products and routine recommended for this client.",
        "fields": [
            f("products", "Recommended Quench Elegance products", "products"),
            f("morning", "Morning routine", "text", half=True),
            f("evening", "Evening routine", "text", half=True),
            f("washRoutine", "Hair wash routine", "text"),
            f("instructions", "Additional care instructions", "textarea"),
            f("reviewDate", "Review date", "date", half=True),
        ],
    },
    {
        "id": "followup", "number": 13, "title": "Follow-up & progress tracking", "audience": "consultant",
        "subtitle": "Compare the initial visit with follow-ups.",
        "fields": [
            f("progress", "Progress", "progress", rows=[
                "Hair fall observation", "Scalp condition", "Hair texture", "Hair density appearance", "Client feedback"]),
            f("followUpDate", "Follow-up date", "date", half=True),
            f("remarks", "Consultant remarks", "textarea"),
        ],
    },
    {
        "id": "declaration", "number": 14, "title": "Declaration & consent", "audience": "client", "required": True,
        "subtitle": "Please read and confirm before submitting.",
        "fields": [
            f("accurate", "I confirm that the information I have provided is accurate and complete to the best of my knowledge.", "consent", required=True),
            f("notMedical", "I understand that Quench Elegance provides cosmetic hair and scalp care products and consultation support. This consultation is not a medical diagnosis or a substitute for evaluation by a qualified medical professional.", "consent", required=True),
            f("resultsVary", "I understand that individual hair and scalp responses vary, and no specific results or timelines are guaranteed.", "consent", required=True),
            f("informAllergies", "I agree to inform the consultant about any allergies, sensitivities, medical conditions or adverse reactions before using recommended products.", "consent", required=True),
            f("photoConsent", "Photography consent", "multi", required=True, options=[
                "I consent to photographs being taken for private consultation and progress tracking.",
                "I separately consent to photographs being used for marketing or promotional purposes.",
                "I do not consent to photography."], exclusive=["I do not consent to photography."]),
            f("signature", "Type your full name as your signature", "text", required=True),
        ],
    },
]

SECTIONS = {s["id"]: s for s in FORM}
CLIENT_SECTIONS = [s for s in FORM if s["audience"] == "client"]
CONSULTANT_SECTIONS = [s for s in FORM if s["audience"] == "consultant"]
TEXT_LIMITS = {"textarea": 2000, "text": 200, "email": 120, "tel": 15, "date": 10, "number": 3}


def _empty(field: dict, value) -> bool:
    if field["type"] == "consent":
        return value is not True
    return value in (None, "", [], {})


def section_applies(section: dict, answers: dict) -> bool:
    cond = section.get("condition")
    if not cond:
        return True
    value = answers.get(cond["section"], {}).get(cond["field"])
    return value not in cond.get("notIn", [])


def _clean_field(field: dict, raw: dict, out: dict) -> None:
    fid, t, v = field["id"], field["type"], raw.get(field["id"])
    if t in TEXT_LIMITS:
        s = clip(v, TEXT_LIMITS[t])
        if t == "number":
            s = re.sub(r"\D", "", s)
        if t == "date" and s and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
            s = ""
        if s:
            out[fid] = s
    elif t == "single":
        if v in field["options"]:
            out[fid] = v
    elif t == "multi":
        chosen = [o for o in field["options"] if isinstance(v, list) and o in v]
        excl = [o for o in chosen if o in field.get("exclusive", [])]
        chosen = excl[-1:] if excl else chosen  # an exclusive answer ("None") wins over the rest
        if chosen:
            out[fid] = chosen
    elif t == "consent":
        if v is True:
            out[fid] = True
    elif t == "products":
        items = [clip(x, 120) for x in (v if isinstance(v, list) else []) if clip(x, 120)]
        if items:
            out[fid] = items[:20]
    elif t == "progress":
        rows = {}
        for row in field["rows"]:
            cell = (v or {}).get(row) if isinstance(v, dict) else None
            if isinstance(cell, dict):
                c = {k: clip(cell.get(k), 300) for k in ("initial", "followUp") if clip(cell.get(k), 300)}
                if c:
                    rows[row] = c
        if rows:
            out[fid] = rows
    # free-text companions
    picked = out.get(fid)
    if field.get("other") and ("Other" == picked or (isinstance(picked, list) and "Other" in picked)):
        s = clip(raw.get(f"{fid}Other"), 200)
        if s:
            out[f"{fid}Other"] = s
    fu = field.get("followUp")
    if fu and picked == fu["when"]:
        s = clip(raw.get(fu["id"]), 500)
        if s:
            out[fu["id"]] = s


def clean_sections(raw: dict, sections: list[dict]) -> dict:
    """Keeps only known fields with allowed values, trimmed to sensible lengths."""
    raw = raw if isinstance(raw, dict) else {}
    out = {}
    for s in sections:
        sec_raw = raw.get(s["id"]) if isinstance(raw.get(s["id"]), dict) else {}
        sec = {}
        for field in s["fields"]:
            _clean_field(field, sec_raw, sec)
        if sec:
            out[s["id"]] = sec
    return out


def clean_client_submission(body: dict) -> dict:
    """Validates a customer's registration consultation. Raises ApiError with a section-specific message."""
    body = body if isinstance(body, dict) else {}
    answers = clean_sections(body.get("answers"), CLIENT_SECTIONS)
    skipped_in = body.get("skipped") if isinstance(body.get("skipped"), list) else []

    skipped = []
    for s in CLIENT_SECTIONS:
        if not section_applies(s, answers):
            answers.pop(s["id"], None)
            skipped.append(s["id"])
            continue
        if s["id"] in skipped_in:
            if s.get("required"):
                raise ApiError(400, f"Section {s['number']} – {s['title']} is required and can't be skipped.", section=s["id"])
            answers.pop(s["id"], None)
            skipped.append(s["id"])
            continue
        if s.get("required"):
            sec = answers.get(s["id"], {})
            for field in s["fields"]:
                if field.get("required") and _empty(field, sec.get(field["id"])):
                    raise ApiError(400, f"Please complete “{field['label'][:60]}” in section {s['number']} – {s['title']}.", section=s["id"], field=field["id"])

    personal = answers.get("personal", {})
    phone = normalize_phone(personal.get("mobile"))
    if not phone:
        raise ApiError(400, "Enter a valid 10-digit Indian mobile number in section 1.", section="personal", field="mobile")
    personal["mobile"] = phone
    if personal.get("whatsapp"):
        personal["whatsapp"] = normalize_phone(personal["whatsapp"]) or ""
        if not personal["whatsapp"]:
            raise ApiError(400, "Enter a valid WhatsApp number in section 1, or leave it empty.", section="personal", field="whatsapp")
    age = int(personal.get("age") or 0)
    if not 1 <= age <= 120:
        raise ApiError(400, "Please enter a valid age in section 1.", section="personal", field="age")
    if personal.get("email") and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", personal["email"]):
        raise ApiError(400, "Please enter a valid email address in section 1.", section="personal", field="email")

    return {"answers": answers, "skipped": skipped, "submittedAt": datetime.now(timezone.utc).isoformat(), "version": 1}


def clean_consultant(body: dict) -> dict:
    return clean_sections(body, CONSULTANT_SECTIONS)


def summary(consultation: dict | None) -> dict | None:
    """Small digest for list views."""
    if not consultation:
        return None
    a = consultation.get("answers", {})
    concerns = a.get("concerns", {})
    return {
        "concerns": concerns.get("primaryConcerns", []),
        "duration": concerns.get("duration", ""),
        "submittedAt": consultation.get("submittedAt"),
        "hasAssessment": bool(consultation.get("consultant", {}).get("assessment")),
        "flags": referral_flags(consultation),
    }


def referral_flags(consultation: dict | None) -> list[str]:
    """Signs that call for a dermatologist referral (per Quench Elegance's professional guidelines)."""
    if not consultation:
        return []
    a = consultation.get("answers", {})
    c, s = a.get("concerns", {}), a.get("scalp", {})
    flags = []
    if c.get("hairFallLevel") == "Severe":
        flags.append("Severe hair fall")
    elif c.get("hairFallLevel") == "Sudden increase in hair fall":
        flags.append("Sudden increase in hair fall")
    if "Patchy hair loss" in c.get("affectedArea", []) or "Bald patches" in c.get("primaryConcerns", []):
        flags.append("Patchy hair loss / bald patches")
    inflamed = [x for x in s.get("scalpSymptoms", []) if x in ("Redness", "Burning sensation", "Scalp tenderness")]
    if inflamed:
        flags.append("Scalp " + ", ".join(x.lower() for x in inflamed))
    if s.get("scalpInfection") == "Yes":
        flags.append("History of scalp infection / condition")
    return flags
