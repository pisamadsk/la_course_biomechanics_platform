import urllib.request
import bz2
import os
import sys

url = "http://ciscobinary.openh264.org/openh264-1.8.0-win64.dll.bz2"
dll_name = "openh264-1.8.0-win64.dll"
archive_name = dll_name + ".bz2"

print(f"Downloading {url}...")
try:
    urllib.request.urlretrieve(url, archive_name)
    print("Download complete.")

    print(f"Decompressing to {dll_name}...")
    with bz2.open(archive_name, "rb") as source, open(dll_name, "wb") as dest:
        dest.write(source.read())
    
    print("Decompression complete.")
    
    # Clean up archive
    os.remove(archive_name)
    print("Done.")

except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
