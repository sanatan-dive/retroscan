from __future__ import annotations
"""Report generation endpoints."""

import io
import json
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse, Response

from app.services.report_generator import generate_pdf_report, generate_excel_report
from app.services.database import get_scan, get_scan_detections

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/{scan_id}/pdf")
async def download_pdf_report(
    scan_id: str,
    lang: str = Query("en", description="Report language: en, hi, or bilingual"),
):
    """Generate and download IRC compliance report as PDF.

    Use ``?lang=en`` (default), ``?lang=hi``, or ``?lang=bilingual`` to render
    the report in English, Hindi, or both languages side-by-side.
    """
    scan = get_scan(scan_id)
    if not scan:
        raise HTTPException(404, f"Scan {scan_id} not found")
    if scan["status"] != "completed":
        raise HTTPException(400, "Scan is still processing. Please wait.")

    normalized_lang = (lang or "en").lower()
    if normalized_lang not in {"en", "hi", "bilingual"}:
        normalized_lang = "en"

    try:
        pdf_bytes = generate_pdf_report(scan_id, language=normalized_lang)
    except Exception as e:
        raise HTTPException(500, f"Report generation failed: {str(e)}")

    suffix = {"en": "EN", "hi": "HI", "bilingual": "EN-HI"}[normalized_lang]

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f"attachment; filename=RetroScan_Report_{scan_id[:8]}_{suffix}.pdf"
            )
        },
    )


@router.get("/{scan_id}/excel")
async def download_excel_report(scan_id: str):
    """Generate and download data export as Excel."""
    scan = get_scan(scan_id)
    if not scan:
        raise HTTPException(404, f"Scan {scan_id} not found")
    if scan["status"] != "completed":
        raise HTTPException(400, "Scan is still processing. Please wait.")

    try:
        excel_bytes = generate_excel_report(scan_id)
    except Exception as e:
        raise HTTPException(500, f"Report generation failed: {str(e)}")

    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=RetroScan_Data_{scan_id[:8]}.xlsx"
        },
    )


@router.get("/{scan_id}/geojson")
async def download_geojson(scan_id: str):
    """Export scan detections as GeoJSON FeatureCollection."""
    scan = get_scan(scan_id)
    if not scan:
        raise HTTPException(404, f"Scan {scan_id} not found")

    detections = get_scan_detections(scan_id)
    features = []

    for det in detections:
        lat = det.get("gps_lat")
        lng = det.get("gps_lng")
        if lat is None or lng is None:
            continue

        compliance = det.get("compliance") or {}
        if isinstance(compliance, str):
            try:
                compliance = json.loads(compliance)
            except Exception:
                compliance = {}

        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lng, lat]},
            "properties": {
                "id": det["id"],
                "class_name": det["class_name"],
                "category": det["category"],
                "retro_class": det["retro_class"],
                "retro_score": det["retro_score"],
                "condition_grade": det["condition_grade"],
                "sign_text": det.get("sign_text", ""),
                "sheeting_type": det.get("sheeting_type", ""),
                "irc_compliant": bool(compliance.get("compliant", False)),
                "irc_standard": compliance.get("standard", ""),
                "priority": det["priority"],
                "priority_label": det.get("priority_label", ""),
                "cost_estimate_inr": det.get("cost_estimate", 0),
                "age_estimate": det.get("age_estimate", ""),
                "remaining_life": det.get("remaining_life", ""),
            },
        })

    geojson = {
        "type": "FeatureCollection",
        "name": f"RetroScan-{scan_id[:8]}",
        "metadata": {
            "scan_id": scan_id,
            "filename": scan["filename"],
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "total_features": len(features),
        },
        "features": features,
    }

    return Response(
        content=json.dumps(geojson, indent=2),
        media_type="application/geo+json",
        headers={
            "Content-Disposition": f"attachment; filename=RetroScan_{scan_id[:8]}.geojson"
        },
    )


@router.get("/{scan_id}/kml")
async def download_kml(scan_id: str):
    """Export scan detections as KML for Google Earth."""
    scan = get_scan(scan_id)
    if not scan:
        raise HTTPException(404, f"Scan {scan_id} not found")

    detections = get_scan_detections(scan_id)

    # Build KML with color-coded styles by retro class
    styles = """
    <Style id="high">
      <IconStyle><color>ff00c850</color><scale>1.1</scale>
        <Icon><href>https://maps.google.com/mapfiles/kml/paddle/grn-circle.png</href></Icon>
      </IconStyle>
    </Style>
    <Style id="medium">
      <IconStyle><color>ff00a5f5</color><scale>1.1</scale>
        <Icon><href>https://maps.google.com/mapfiles/kml/paddle/ylw-circle.png</href></Icon>
      </IconStyle>
    </Style>
    <Style id="low">
      <IconStyle><color>ff0064f9</color><scale>1.2</scale>
        <Icon><href>https://maps.google.com/mapfiles/kml/paddle/orange-circle.png</href></Icon>
      </IconStyle>
    </Style>
    <Style id="failed">
      <IconStyle><color>ff0000ee</color><scale>1.3</scale>
        <Icon><href>https://maps.google.com/mapfiles/kml/paddle/red-circle.png</href></Icon>
      </IconStyle>
    </Style>
    """

    placemarks = []
    for det in detections:
        lat = det.get("gps_lat")
        lng = det.get("gps_lng")
        if lat is None or lng is None:
            continue

        style_id = det["retro_class"].lower()
        compliance = det.get("compliance") or {}
        if isinstance(compliance, str):
            try:
                compliance = json.loads(compliance)
            except Exception:
                compliance = {}

        compliant_txt = "PASS" if compliance.get("compliant") else "FAIL"
        name_text = det["class_name"].replace("_", " ").title()
        if det.get("sign_text"):
            name_text += f" — {det['sign_text']}"

        description = f"""
        <![CDATA[
        <div style="font-family: Arial, sans-serif;">
          <b>Retroreflectivity Score:</b> {det['retro_score']:.0f}/100<br/>
          <b>Class:</b> {det['retro_class']} (Grade {det['condition_grade']})<br/>
          <b>IRC Compliance:</b> <span style="color: {'green' if compliance.get('compliant') else 'red'};">{compliant_txt}</span><br/>
          <b>Priority:</b> {det.get('priority_label', '')}<br/>
          <b>Estimated Age:</b> {det.get('age_estimate', 'Unknown')}<br/>
          <b>Sheeting Type:</b> {det.get('sheeting_type', 'Unknown')}<br/>
        </div>
        ]]>
        """

        placemarks.append(f"""
    <Placemark>
      <name>{name_text}</name>
      <description>{description}</description>
      <styleUrl>#{style_id}</styleUrl>
      <Point><coordinates>{lng},{lat},0</coordinates></Point>
    </Placemark>""")

    kml_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>RetroScan AI — {scan['filename']}</name>
    <description>Retroreflectivity survey results exported from RetroScan AI</description>
    {styles}
    {''.join(placemarks)}
  </Document>
</kml>"""

    return Response(
        content=kml_content,
        media_type="application/vnd.google-earth.kml+xml",
        headers={
            "Content-Disposition": f"attachment; filename=RetroScan_{scan_id[:8]}.kml"
        },
    )
