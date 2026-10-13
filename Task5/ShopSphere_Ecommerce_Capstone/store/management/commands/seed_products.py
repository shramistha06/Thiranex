from django.core.management.base import BaseCommand
from store.models import Product

PRODUCTS = [
    ("Wireless Headphones", "wireless-headphones", "Comfortable wireless headphones with rich sound and a long-lasting battery.", "Electronics", "2499.00", "https://images.unsplash.com/photo-1508047199990-4b9e9c1a8d8d?auto=format&fit=crop&w=900&q=80", 25, True),
    ("Everyday Backpack", "everyday-backpack", "A lightweight everyday backpack with a padded laptop compartment.", "Accessories", "1599.00", "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80", 30, True),
    ("Minimal Wristwatch", "minimal-wristwatch", "A clean, minimalist watch designed for everyday wear.", "Accessories", "3299.00", "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80", 14, False),
    ("Running Sneakers", "running-sneakers", "Cushioned running sneakers for workouts and daily walks.", "Fashion", "2799.00", "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80", 18, True),
    ("Ceramic Coffee Mug", "ceramic-coffee-mug", "A durable ceramic mug for your coffee or tea ritual.", "Home", "399.00", "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=80", 60, False),
    ("Desk Lamp", "desk-lamp", "A modern desk lamp for focused work and warm ambient light.", "Home", "1199.00", "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80", 20, False),
    ("Smart Speaker", "smart-speaker", "A compact speaker for podcasts, music, and everyday listening.", "Electronics", "2199.00", "https://images.unsplash.com/photo-1589003077984-894e133dabab?auto=format&fit=crop&w=900&q=80", 12, False),
    ("Sunglasses", "sunglasses", "Classic sunglasses with a versatile everyday frame.", "Fashion", "899.00", "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=900&q=80", 40, False),
]

class Command(BaseCommand):
    help = "Create sample products for ShopSphere"

    def handle(self, *args, **options):
        for name, slug, description, category, price, image_url, stock, featured in PRODUCTS:
            Product.objects.update_or_create(
                slug=slug,
                defaults={
                    "name": name, "description": description, "category": category,
                    "price": price, "image_url": image_url, "stock": stock,
                    "featured": featured,
                },
            )
        self.stdout.write(self.style.SUCCESS("Sample products created/updated."))
