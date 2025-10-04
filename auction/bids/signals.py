from django.db.models.signals import post_save
from django.dispatch import receiver
from bids.models import SellerRating, BidderRating

@receiver(post_save, sender=SellerRating)
def update_seller_rating_on_create(sender, instance: SellerRating, created, **kwargs):
    if created:
        # Get the seller from the winning pair
        winning_pair = instance.winning_pair
        seller = winning_pair.item.seller
        # Call the add_rating method (or your preferred logic)
        seller.add_rating(instance.rating)

@receiver(post_save, sender=BidderRating)
def update_bidder_rating_on_create(sender, instance: BidderRating, created, **kwargs):
    if created:
        # Get the bidder from the winning pair
        winning_pair = instance.winning_pair
        seller = winning_pair.winning_bidder
        seller.add_rating(instance.rating)
