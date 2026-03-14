#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont

SIZE = 512
img  = Image.new('RGB', (SIZE, SIZE), (0, 0, 0))
draw = ImageDraw.Draw(img)

# Grid
for i in range(0, SIZE, 32):
    draw.line([(i,0),(i,SIZE)], fill=(8,8,18), width=1)
    draw.line([(0,i),(SIZE,i)], fill=(8,8,18), width=1)

# Road perspective
road = [(140,512),(372,512),(296,200),(216,200)]
draw.polygon(road, fill=(18,18,40))
draw.line([(140,512),(216,200)], fill=(255,45,120), width=5)
draw.line([(372,512),(296,200)], fill=(255,45,120), width=5)
draw.line([(0,200),(512,200)],   fill=(0,245,255),  width=3)

# Centre dashes
for y in range(220, 510, 60):
    t = (y-200)/310
    cx = 256
    w = int(4+t*20); h = int(8+t*24)
    draw.rectangle([cx-w//2, y, cx+w//2, y+h], fill=(255,255,255))

# Car body (3D box illusion)
car_pts = [(200,370),(312,370),(322,330),(190,330)]
draw.polygon(car_pts, fill=(200,0,68))
roof_pts = [(210,330),(302,330),(292,296),(220,296)]
draw.polygon(roof_pts, fill=(140,0,44))
# Windscreen
ws_pts = [(218,330),(294,330),(286,300),(226,300)]
draw.polygon(ws_pts, fill=(80,180,220))
# Side highlight
draw.line([(190,330),(200,370)], fill=(255,45,120), width=3)
draw.line([(322,330),(312,370)], fill=(80,40,60), width=3)
# Wheels
for wx, wy in [(205,368),(307,368)]:
    draw.ellipse([wx-16,wy-8,wx+16,wy+8], fill=(20,20,20), outline=(80,80,80), width=2)
    draw.ellipse([wx-8,wy-4,wx+8,wy+4], fill=(140,140,140))
# Headlights
draw.rectangle([194,344,206,352], fill=(255,255,180))
draw.rectangle([306,344,318,352], fill=(255,255,180))

try:
    font_big = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 52)
    font_sm  = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36)
except:
    font_big = font_sm = ImageFont.load_default()

for text, font, y, col in [
    ("TAR",    font_big, 420, (255,45,120)),
    ("BLAZER", font_sm,  468, (0,245,255)),
]:
    bb = font.getbbox(text)
    draw.text((256-(bb[2]-bb[0])//2, y), text, font=font, fill=col)

img.save('public/icon.png', 'PNG')
print("icon.png saved")
