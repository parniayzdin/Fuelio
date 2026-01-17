
import json
import datetime
from pathlib import Path

def test_import():
    try:
        with open("sample_timeline.json", "r") as f:
            data = json.load(f)
    except Exception as e:
        print(f"Failed to load JSON: {e}")
        return

    print("JSON loaded successfully.")
    
    segments = []
    
    if "timelineObjects" in data:
        print("Found timelineObjects")
        for obj in data["timelineObjects"]:
            if "activitySegment" in obj:
                segments.append(obj["activitySegment"])
    elif "semanticSegments" in data:
        print("Found semanticSegments")
        for obj in data["semanticSegments"]:
             if "activity" in obj:
                 segments.append(obj)
    
    print(f"Found {len(segments)} segments.")
    
    imported_count = 0
    
    for i, segment in enumerate(segments):
        print(f"Processing segment {i+1}...")
        try:
            # Detect transport type
            activity_type = segment.get("activityType", "").upper()
            if not activity_type:
                 activity_type = segment.get("activity", {}).get("topCandidate", {}).get("type", "").upper()
            
            print(f"  Activity Type: {activity_type}")

            if activity_type not in ["IN_PASSENGER_VEHICLE", "IN_VEHICLE", "DRIVING", "IN_CAR"]:
                print("  -> SKIPPING (Invalid Type)")
                continue
                
            # Extract start/end
            start_loc = segment.get("startLocation", {})
            start_lat = start_loc.get("latitudeE7") / 1e7 if "latitudeE7" in start_loc else None
            start_lng = start_loc.get("longitudeE7") / 1e7 if "longitudeE7" in start_loc else None
            
            end_loc = segment.get("endLocation", {})
            end_lat = end_loc.get("latitudeE7") / 1e7 if "latitudeE7" in end_loc else None
            end_lng = end_loc.get("longitudeE7") / 1e7 if "longitudeE7" in end_loc else None
            
            # Time
            duration = segment.get("duration", {})
            start_ts = duration.get("startTimestamp")
            end_ts = duration.get("endTimestamp")
            
            if not (start_ts and end_ts):
                print("  -> SKIPPING (Missing Timestamps)")
                continue
                
            print(f"  Start TS: {start_ts}")
            
            # This is the line from the backend
            start_time = datetime.datetime.fromisoformat(start_ts.replace("Z", "+00:00"))
            end_time = datetime.datetime.fromisoformat(end_ts.replace("Z", "+00:00"))
            
            print(f"  Parsed Start Time: {start_time}")

            # Distance
            distance_meters = segment.get("distance", 0)
            distance_km = float(distance_meters) / 1000.0 if distance_meters else None
            
            print(f"  Distance: {distance_km} km")
            
            imported_count += 1
            print("  -> SUCCESS")
            
        except Exception as e:
            print(f"  -> ERROR: {e}")
            import traceback
            traceback.print_exc()

    print(f"\nTotal Imported: {imported_count}")

if __name__ == "__main__":
    test_import()
