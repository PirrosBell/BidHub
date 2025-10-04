from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_nested import routers
from .views import (
    ItemViewSet, BidViewSet, BidderViewSet, SellerViewSet,
    CategoryViewSet, SellerRatingsViewSet, BidderRatingsViewSet,
    WinningPairViewSet, ItemImageViewSet, MessageViewset
)

router = DefaultRouter()

router.register(r'items', ItemViewSet, basename='item')
router.register(r'bids', BidViewSet, basename='bid')
router.register(r'bidders', BidderViewSet, basename='bidder')
router.register(r'sellers', SellerViewSet, basename='seller')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'seller-ratings', SellerRatingsViewSet, basename='seller-rating')
router.register(r'bidder-ratings', BidderRatingsViewSet, basename='bidder-rating')
router.register(r'winning-pairs', WinningPairViewSet, basename='winning-pair')
router.register(r'messages', MessageViewset, basename='message')

items_router = routers.NestedDefaultRouter(router, r'items', lookup='item')
items_router.register(r'images', ItemImageViewSet, basename='item-images')

urlpatterns = [
    path('', include(router.urls)),
    
    # Include nested router URLs for item images
    path('', include(items_router.urls)),
    
    # Custom action URLs (these are automatically handled by DRF, but listed here for clarity)
    # Items custom actions:
    # - GET /items/ending_soon/
    # - POST /items/{id}/publish/
    
    # Bidders custom actions:
    # - GET /bidders/{id}/bids/
    
    # Sellers custom actions:
    # - GET /sellers/{id}/items/
    
    # Seller ratings custom actions:
    # - GET /seller-ratings/received/
    # - GET /seller-ratings/given/
    
    # Bidder ratings custom actions:
    # - GET /bidder-ratings/received/
    # - GET /bidder-ratings/given/
    
    # Winning pairs custom actions:
    # - GET /winning-pairs/{id}/messages/
]