from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django_countries.fields import CountryField 
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.exceptions import ValidationError
from PIL import Image
from decimal import *
import os

getcontext().prec = 2

def item_image_path(instance, filename):
    ext = filename.split('.')[-1]
    return os.path.join('item_images', f'item_{instance.item.id}', filename)

def item_main_image_path(instance, filename):
    ext = filename.split('.')[-1]
    filename = f'main_{instance.id}.{ext}'
    return os.path.join('item_images', 'main', filename)


def get_default_item_main_image():
    return '1222945_stock-photo-generic-toothpaste.jpg'


ITEM_STATUS_CHOICES = [
    ('active', 'Active'),
    ('sold', 'Sold'),
    ('expired', 'Expired'),
    ('cancelled', 'Cancelled'),
    ('pending', 'Pending'),
]

WINNING_PAIR_STATUS_CHOICES = [
    ('active', 'Active'),
    ('inactive', 'Inactive'),
]

class Item(models.Model):
    name = models.CharField(max_length=200)
    categories = models.ManyToManyField("Category", related_name='items')
    current_bid = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal(0.01))])
    buy_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, validators=[MinValueValidator(Decimal(0.01))]) # Option param
    first_bid = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal(0.01))])
    number_of_bids = models.PositiveIntegerField(default=0)
    country = CountryField(null=False, blank=False)
    location = models.ForeignKey("Location", related_name='item', on_delete=models.PROTECT)
    started = models.DateTimeField(null=True, blank=True)
    ends = models.DateTimeField()
    seller = models.ForeignKey("Seller", related_name='items', on_delete=models.CASCADE)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=ITEM_STATUS_CHOICES)
    index = models.PositiveIntegerField(null=True, default=None)
    main_image = models.ImageField(
        upload_to=item_main_image_path,
        default=get_default_item_main_image,
        blank=True,
        null=True,
        help_text="Main display image for the item"
    )
    
    def __str__(self):
        return self.name
    
    def check_and_update_status(self):
        now = timezone.now()
        if self.status == 'active' and self.ends < now:
            self.status = 'expired'
            self.save()

    def publish(self):
        if self.status != 'pending':
            raise ValidationError("This item cannot be published as it is not pending.")

        self.status = 'active'
        self.started = timezone.now()
        self.save()

    def close(self):
        if self.number_of_bids == 0:
            now = timezone.now()
            if self.ends <= now:
                self.status = 'expired'
            else:
                self.status = 'cancelled'
            self.save()
            return True
        self.status = 'sold'
        self.save()

        try:
            bid = Bid.objects.get(amount=self.current_bid, item=self.id)
        except:
            return False

        try:
            WinningPair.objects.create(item=self, winning_bid=bid, winning_bidder=bid.bidder)
            return True
        except:
            return False




class ItemImage(models.Model):
    item = models.ForeignKey(Item, related_name='additional_images', on_delete=models.CASCADE)
    image = models.ImageField(
        upload_to=item_image_path,
        help_text="Additional images for the item"
    )
    alt_text = models.CharField(max_length=200, blank=True, help_text="Alternative text for the image")
    order = models.PositiveIntegerField(default=0, help_text="Display order of the image")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'uploaded_at']

    def __str__(self):
        return f"Image for {self.item.name} (Order: {self.order})"
    
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        
        if self.image:
            img = Image.open(self.image.path)
            if img.height > 800 or img.width > 800:
                output_size = (800, 800)
                img.thumbnail(output_size)
                img.save(self.image.path)

class Bidder(models.Model):
    userID = models.OneToOneField(User, related_name='bidder_id', on_delete = models.CASCADE)
    avg_rating = models.DecimalField(max_digits=2, decimal_places=1, validators = [MinValueValidator(0), MaxValueValidator(5)], default=0.0)
    rating_count = models.PositiveIntegerField(default=0)
    location = models.ForeignKey("Location", on_delete=models.PROTECT, related_name='bidders')
    created_at = models.DateTimeField(auto_now_add=True)
    country = CountryField(null=False, blank=False)

    def add_rating(self, rating):
        total = self.avg_rating * self.rating_count
        self.rating_count += 1
        self.avg_rating = (total + rating) / self.rating_count
        self.save(update_fields=['avg_rating', 'rating_count'])

    def remove_rating(self, rating):
        if self.rating_count <= 1:
            self.avg_rating = 0
            self.rating_count = 0
        else:
            total = self.avg_rating * self.rating_count
            self.rating_count -= 1
            self.avg_rating = (total - rating) / self.rating_count
        self.save(update_fields=['avg_rating', 'rating_count'])

    def update_rating(self, old_rating, new_rating):
        total = self.avg_rating * self.rating_count
        self.avg_rating = (total - old_rating + new_rating) / self.rating_count
        self.save(update_fields=['avg_rating'])

class Visit(models.Model):
    bidder = models.ForeignKey("Bidder", related_name='visits', on_delete=models.CASCADE)
    item = models.ForeignKey("Item", related_name='visits', on_delete=models.CASCADE)
    visited_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('bidder', 'item')  
        ordering = ['-visited_at']  


class Bid(models.Model):
    item = models.ForeignKey("Item", related_name='bids', on_delete=models.CASCADE)
    bidder = models.ForeignKey("Bidder", related_name='bids', on_delete=models.CASCADE)
    time = models.DateTimeField(auto_now=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal(0.01))])

class Location(models.Model):
    address = models.CharField(max_length=200)
    latitude = models.FloatField( 
        null=True, blank=True,
        validators=[MinValueValidator(Decimal(-90)), MaxValueValidator(Decimal(90))]
    )
    longitude = models.FloatField( 
        null=True, blank=True,
        validators=[MinValueValidator(Decimal(-180)), MaxValueValidator(Decimal(180))]
    )
    def __str__(self):
        return self.address
        
# Seller model
class Seller(models.Model):
    userID = models.OneToOneField(User, related_name='seller_id', on_delete=models.CASCADE) 
    avg_rating = models.DecimalField(max_digits=2, decimal_places=1, validators=[MinValueValidator(0), MaxValueValidator(5)], default=0.0)
    rating_count = models.PositiveIntegerField(validators=[MinValueValidator(0)], default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def add_rating(self, rating):
        total = self.avg_rating * self.rating_count
        self.rating_count += 1
        self.avg_rating = (total + rating) / self.rating_count
        self.save(update_fields=['avg_rating', 'rating_count'])

    def remove_rating(self, rating):
        if self.rating_count <= 1:
            self.avg_rating = 0
            self.rating_count = 0
        else:
            total = self.avg_rating * self.rating_count
            self.rating_count -= 1
            self.avg_rating = (total - rating) / self.rating_count
        self.save(update_fields=['avg_rating', 'rating_count'])

    def update_rating(self, old_rating, new_rating):
        total = self.avg_rating * self.rating_count
        self.avg_rating = (total - old_rating + new_rating) / self.rating_count
        self.save(update_fields=['avg_rating'])

# Category model
class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name
    
# Bidder Rating model
class BidderRating(models.Model):
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    winning_pair = models.OneToOneField('WinningPair', related_name='bidder_review', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

# Seller Rating model
class SellerRating(models.Model):
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    created_at = models.DateTimeField(auto_now_add=True)
    winning_pair = models.OneToOneField('WinningPair', related_name='seller_review', on_delete=models.CASCADE)


# WinningPair model
class WinningPair(models.Model):
    item = models.OneToOneField("Item", related_name='winning_pair', on_delete=models.CASCADE)
    winning_bidder = models.ForeignKey("Bidder", related_name='winning_pairs', on_delete=models.PROTECT)
    winning_bid = models.ForeignKey("Bid", related_name='winning_pairs', on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=WINNING_PAIR_STATUS_CHOICES, default='active')

    deleted_by_seller = models.BooleanField(default=False)
    deleted_by_bidder = models.BooleanField(default=False)




    class Meta:
        unique_together = ('item', 'winning_bidder')  # Ensure a bidder can only win an item once

    def deactivate(self):
        """
        Deactivates the winning pair, marking it as inactive.
        """
        self.status = 'inactive'
        self.save()

# Message model
class Message(models.Model):
    winning_pair = models.ForeignKey("WinningPair", related_name='messages', on_delete=models.CASCADE)
    sender = models.ForeignKey(User, related_name='sent_messages', on_delete=models.CASCADE)
    recipient = models.ForeignKey(User, related_name='received_messages', on_delete=models.CASCADE)
    content = models.TextField()
    sent_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    def __str__(self):
        return f"Message from {self.sender.username} to {self.recipient.username} at {self.sent_at} about {self.winning_pair.item.name}"

class Visited(models.Model):
    bidder = models.ForeignKey("Bidder", related_name='visited_items', on_delete=models.CASCADE)
    item = models.ForeignKey("Item", related_name='visited_by', on_delete=models.CASCADE)
    visited_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-visited_at']  # Order by most recent visit first

