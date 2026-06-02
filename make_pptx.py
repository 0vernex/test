from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt
import copy

prs = Presentation()
prs.slide_width  = Inches(13.33)
prs.slide_height = Inches(7.5)

BG       = RGBColor(0x0f, 0x0f, 0x1a)
ACCENT   = RGBColor(0x7c, 0x3a, 0xed)
ACCENT2  = RGBColor(0x60, 0xa5, 0xfa)
TITLE_C  = RGBColor(0xa7, 0x8b, 0xfa)
BODY_C   = RGBColor(0xcc, 0xcc, 0xcc)
TAG_C    = RGBColor(0xa7, 0x8b, 0xfa)
WHITE    = RGBColor(0xff, 0xff, 0xff)
DARK2    = RGBColor(0x1a, 0x1a, 0x2e)
MUTED    = RGBColor(0x88, 0x88, 0x88)

blank_layout = prs.slide_layouts[6]  # completely blank

def add_slide():
    return prs.slides.add_slide(blank_layout)

def set_bg(slide, color=BG):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = color

def add_rect(slide, l, t, w, h, color, transparency=0):
    shape = slide.shapes.add_shape(1, Inches(l), Inches(t), Inches(w), Inches(h))
    shape.line.fill.background()
    fill = shape.fill
    fill.solid()
    fill.fore_color.rgb = color
    return shape

def add_textbox(slide, text, l, t, w, h,
                font_size=18, bold=False, color=BODY_C,
                align=PP_ALIGN.LEFT, wrap=True, italic=False):
    txBox = slide.shapes.add_textbox(Inches(l), Inches(t), Inches(w), Inches(h))
    txBox.word_wrap = wrap
    tf = txBox.text_frame
    tf.word_wrap = wrap
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.size = Pt(font_size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    return txBox

def add_tag(slide, text, l, t):
    add_rect(slide, l, t, len(text)*0.11+0.3, 0.32, RGBColor(0x2a, 0x1a, 0x4a))
    add_textbox(slide, text, l+0.12, t+0.03, len(text)*0.11+0.1, 0.28,
                font_size=11, bold=True, color=TAG_C)

def add_accent_bar(slide):
    add_rect(slide, 0, 0, 0.08, 7.5, ACCENT)

def bullet_block(slide, items, l, t, w, h, font_size=16):
    txBox = slide.shapes.add_textbox(Inches(l), Inches(t), Inches(w), Inches(h))
    txBox.word_wrap = True
    tf = txBox.text_frame
    tf.word_wrap = True
    first = True
    for item in items:
        if first:
            p = tf.paragraphs[0]
            first = False
        else:
            p = tf.add_paragraph()
        p.space_before = Pt(4)
        p.space_after = Pt(4)
        run = p.add_run()
        run.text = "▸  " + item
        run.font.size = Pt(font_size)
        run.font.color.rgb = BODY_C

def box_with_title(slide, title, items, l, t, w, h, font_size=15):
    add_rect(slide, l, t, w, h, RGBColor(0x16, 0x16, 0x2e))
    add_textbox(slide, title, l+0.15, t+0.12, w-0.3, 0.35,
                font_size=13, bold=True, color=TITLE_C)
    bullet_block(slide, items, l+0.15, t+0.5, w-0.3, h-0.6, font_size=font_size)

# ── Slide 1: Titel ──────────────────────────────────────────────────────────
s = add_slide(); set_bg(s); add_accent_bar(s)
add_tag(s, "INFORMATIEVE PRESENTATIE", 0.4, 0.5)
add_textbox(s, "ADHD", 0.4, 1.1, 12, 1.8, font_size=72, bold=True, color=TITLE_C)
add_textbox(s, "Aandachtstekortstoornis met Hyperactiviteit",
            0.4, 2.7, 12, 0.6, font_size=22, color=MUTED)
add_textbox(s, "Wat is het? Wie heeft het? En hoe leven mensen ermee?",
            0.4, 3.5, 12, 0.5, font_size=16, color=RGBColor(0x55,0x55,0x55))

# ── Slide 2: Wat is ADHD? ───────────────────────────────────────────────────
s = add_slide(); set_bg(s); add_accent_bar(s)
add_tag(s, "DEFINITIE", 0.4, 0.4)
add_textbox(s, "Wat is ADHD?", 0.4, 0.9, 12, 0.9, font_size=36, bold=True, color=TITLE_C)
paras = [
    "ADHD staat voor Attention Deficit Hyperactivity Disorder — in het Nederlands: aandachtstekortstoornis met hyperactiviteit.",
    "Het is een neurologische ontwikkelingsstoornis die invloed heeft op aandacht, impulscontrole en activiteitsniveau. ADHD begint in de kindertijd, maar blijft bij veel mensen aanwezig tot in de volwassenheid.",
    "De hersenen van iemand met ADHD werken anders — niet slechter, maar anders.",
]
y = 1.95
for para in paras:
    add_textbox(s, para, 0.4, y, 12.5, 0.7, font_size=16, color=BODY_C)
    y += 0.85

# ── Slide 3: Drie vormen ────────────────────────────────────────────────────
s = add_slide(); set_bg(s); add_accent_bar(s)
add_tag(s, "TYPEN", 0.4, 0.4)
add_textbox(s, "De drie vormen van ADHD", 0.4, 0.9, 12, 0.9, font_size=36, bold=True, color=TITLE_C)

box_with_title(s, "Overwegend Onoplettend",
    ["Moeite met concentreren", "Snel afgeleid", "Vergeetachtig", "Vroeger 'ADD' genoemd"],
    0.4, 2.0, 5.9, 2.2)
box_with_title(s, "Overwegend Hyperactief",
    ["Veel bewegen, friemelen", "Impulsief handelen", "Moeite met stilzitten", "Vaker bij jonge kinderen"],
    6.5, 2.0, 5.9, 2.2)
box_with_title(s, "Gecombineerd type — meest voorkomend",
    ["Kenmerken van zowel onoplettendheid als hyperactiviteit/impulsiviteit zijn aanwezig."],
    0.4, 4.4, 12.0, 1.4)

# ── Slide 4: Symptomen ──────────────────────────────────────────────────────
s = add_slide(); set_bg(s); add_accent_bar(s)
add_tag(s, "SYMPTOMEN", 0.4, 0.4)
add_textbox(s, "Veelvoorkomende symptomen", 0.4, 0.9, 12, 0.9, font_size=36, bold=True, color=TITLE_C)
box_with_title(s, "Onoplettendheid",
    ["Moeite met taken afmaken", "Spullen kwijtraken", "Dagdromen", "Slecht luisteren", "Moeite met plannen"],
    0.4, 2.0, 5.9, 3.5)
box_with_title(s, "Hyperactiviteit & Impulsiviteit",
    ["Niet kunnen wachten", "Anderen onderbreken", "Rusteloos gevoel", "Veel praten", "Risicovol gedrag"],
    6.5, 2.0, 5.9, 3.5)

# ── Slide 5: Cijfers ────────────────────────────────────────────────────────
s = add_slide(); set_bg(s); add_accent_bar(s)
add_tag(s, "FEITEN & CIJFERS", 0.4, 0.4)
add_textbox(s, "ADHD in getallen", 0.4, 0.9, 12, 0.9, font_size=36, bold=True, color=TITLE_C)

stats = [
    ("5–7%",     "van kinderen\nworldwijd heeft ADHD"),
    ("2–5%",     "van volwassenen\nheeft ADHD"),
    ("~170.000", "mensen in Nederland\nmet diagnose"),
    ("3×",       "vaker gediagnosticeerd\nbij jongens dan meisjes"),
    ("60%",      "houdt symptomen\ntot in volwassenheid"),
    ("75%",      "erfelijkheid — sterk\ngenetisch bepaald"),
]
cols = 3
box_w, box_h = 3.9, 1.7
for i, (num, lbl) in enumerate(stats):
    col = i % cols
    row = i // cols
    lx = 0.4 + col * (box_w + 0.2)
    ly = 2.1 + row * (box_h + 0.2)
    add_rect(s, lx, ly, box_w, box_h, RGBColor(0x16, 0x16, 0x2e))
    add_textbox(s, num, lx+0.1, ly+0.15, box_w-0.2, 0.7,
                font_size=28, bold=True, color=TITLE_C, align=PP_ALIGN.CENTER)
    add_textbox(s, lbl, lx+0.1, ly+0.85, box_w-0.2, 0.75,
                font_size=13, color=MUTED, align=PP_ALIGN.CENTER)

# ── Slide 6: Oorzaken ───────────────────────────────────────────────────────
s = add_slide(); set_bg(s); add_accent_bar(s)
add_tag(s, "OORZAKEN", 0.4, 0.4)
add_textbox(s, "Waardoor ontstaat ADHD?", 0.4, 0.9, 12, 0.9, font_size=36, bold=True, color=TITLE_C)
add_textbox(s, "ADHD heeft geen één enkele oorzaak. Het is een samenspel van meerdere factoren:",
            0.4, 1.9, 12.5, 0.5, font_size=16, color=BODY_C)
bullet_block(s, [
    "Genetica — ADHD is sterk erfelijk; het komt vaak voor in families",
    "Hersenontwikkeling — bepaalde hersengebieden (prefrontale cortex) ontwikkelen zich trager",
    "Dopamine & Noradrenaline — tekort aan deze neurotransmitters speelt een rol",
    "Omgevingsfactoren — vroeggeboorte, roken tijdens zwangerschap, stress",
    "Slecht opvoeden of te veel schermtijd zijn GEEN oorzaak",
], 0.4, 2.55, 12.5, 4.0)

# ── Slide 7: Diagnose & Behandeling ────────────────────────────────────────
s = add_slide(); set_bg(s); add_accent_bar(s)
add_tag(s, "BEHANDELING", 0.4, 0.4)
add_textbox(s, "Diagnose & Behandeling", 0.4, 0.9, 12, 0.9, font_size=36, bold=True, color=TITLE_C)
box_with_title(s, "Hoe wordt het vastgesteld?",
    ["Gesprekken met psycholoog/psychiater", "Vragenlijsten (zelf & omgeving)",
     "Observatie van gedrag", "Symptomen aanwezig voor 12e jaar"],
    0.4, 2.0, 5.9, 2.8)
box_with_title(s, "Behandelmogelijkheden",
    ["Medicatie (Ritalin, Concerta)", "Cognitieve gedragstherapie",
     "Coaching & begeleiding", "Psycho-educatie", "Aanpassingen op school/werk"],
    6.5, 2.0, 5.9, 2.8)
add_textbox(s, "Er is geen genezing, maar met de juiste hulp kunnen mensen met ADHD goed functioneren.",
            0.4, 5.1, 12.5, 0.5, font_size=14, color=MUTED, italic=True)

# ── Slide 8: Sterke kanten ──────────────────────────────────────────────────
s = add_slide(); set_bg(s); add_accent_bar(s)
add_tag(s, "LEVEN MET ADHD", 0.4, 0.4)
add_textbox(s, "Sterke kanten van ADHD", 0.4, 0.9, 12, 0.9, font_size=36, bold=True, color=TITLE_C)
add_textbox(s, "ADHD brengt uitdagingen, maar ook unieke sterke kanten:",
            0.4, 1.9, 12.5, 0.5, font_size=16, color=BODY_C)
bullet_block(s, [
    "Hyperfocus — intense concentratie op interessante onderwerpen",
    "Creativiteit — origineel denken en out-of-the-box oplossingen",
    "Energie & enthousiasme — aanstekelijke gedrevenheid",
    "Aanpassingsvermogen — goed in crisissituaties en snel schakelen",
    "Empathie — sterk gevoel voor anderen, vooral bij ADD-type",
], 0.4, 2.55, 12.5, 3.2)
add_textbox(s, "Bekende mensen met ADHD: Albert Einstein, Simone Biles, Justin Timberlake, Richard Branson.",
            0.4, 6.0, 12.5, 0.5, font_size=13, color=MUTED, italic=True)

# ── Slide 9: Conclusie ──────────────────────────────────────────────────────
s = add_slide(); set_bg(s); add_accent_bar(s)
add_tag(s, "CONCLUSIE", 0.4, 0.4)
add_textbox(s, "Samenvatting", 0.4, 0.9, 12, 0.9, font_size=36, bold=True, color=TITLE_C)
bullet_block(s, [
    "ADHD is een neurologische stoornis, geen karakterfout",
    "Het beïnvloedt aandacht, impulsiviteit en activiteitsniveau",
    "Er zijn drie vormen: onoplettend, hyperactief en gecombineerd",
    "Oorzaken zijn grotendeels genetisch",
    "Behandeling combineert medicatie, therapie en begeleiding",
    "Met de juiste steun kunnen mensen met ADHD floreren",
], 0.4, 2.0, 12.5, 4.2, font_size=18)
add_textbox(s, "Begrip en bewustwording maken het verschil.",
            0.4, 6.5, 12.5, 0.5, font_size=14, color=MUTED, italic=True)

prs.save("/home/user/test/adhd_presentatie.pptx")
print("Saved.")
