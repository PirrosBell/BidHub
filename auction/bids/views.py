from bids.models import (Bid, Bidder, Location, Item, ItemImage, Seller, Category,
                         SellerRating, BidderRating, WinningPair, Message, ItemImage, Visited)
from django.contrib.auth.models import User
from django.db.models import Q

from bids.serializers import (
    BidSerializer, CreateBidSerializer,BidderSerializer, 
    AdminItemSerializer, ItemCreateSerializer, ItemDetailSerializer, ItemListSerializer, OwnerItemDetailSerializer, OwnerItemUpdateSerializer,
    SellerRatingSerializer, BidderRatingSerializer, 
    SellerSerializer, CategorySerializer, UserSerializer, LocationSerializer,
    WinningPairSerializer, MessageSerializer, CreateMessageSerializer, ItemImageSerializer
    )

from bids.permissions import (
    IsItemOwnerOrReadOnly, IsBidOwner, BidderPerms, SellerPerms,
    IsAdminOrReadOnly
    )

from bids.utils import generate_recommendations
from rest_framework.exceptions import ValidationError, PermissionDenied
from django.utils import timezone
from datetime import timedelta
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import permissions, viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
import numpy as np

class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.all()
    authentication_classes = [JWTAuthentication]
    filter_backends = [filters.OrderingFilter, filters.SearchFilter]
    ordering_fields = ['ends', 'name', 'buy_price', 'current_bid']
    ordering = ['ends']
    search_fields = ['name', 'description']
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def check_edit_delete_validity(self, item:Item):
        if self.request.user.is_staff : return
        if not item.status == 'pending':
            if not item.status == 'active':
                raise PermissionDenied("You cannot modify this auction item. It has to be active with no bids or peding activation")
            else:
                if item.number_of_bids > 0:
                    raise PermissionDenied("You cannot modify this auction item. It has to be active with no bids or peding activation")
                
    def record_visit(self, user, item:Item):
        if not user.is_authenticated:
            return
        if user.seller_id == item.seller:
            return
        ten_minutes_ago = timezone.now() - timedelta(minutes=10)
        recent_visit = Visited.objects.filter(
            bidder=user.bidder_id,
            item=item,
            visited_at__gte=ten_minutes_ago
        ).exists()
        if not recent_visit:
            Visited.objects.create(bidder=user.bidder_id, item=item)

    def perform_create(self, serializer):
        try:
            serializer.save(
                seller=self.request.user.seller_id,
                status='pending'        
                )
        except:
            raise PermissionError('You do not have seller profile')
        
    def perform_destroy(self, instance):
        self.check_edit_delete_validity(instance)
        return super().perform_destroy(instance)

    def get_serializer_class(self):
        if self.action in ['update', 'partial_update']:
            if self.get_object().seller.userID == self.request.user:
                return OwnerItemUpdateSerializer
            elif self.request.user.is_staff:
                return AdminItemSerializer
        elif self.action == 'create':
            return ItemCreateSerializer
        elif self.action == 'retrieve':
            if self.request.user.is_staff:
                return AdminItemSerializer
            if self.get_object().seller.userID == self.request.user:
                return OwnerItemDetailSerializer
            return ItemDetailSerializer
        return ItemListSerializer

    def get_queryset(self):
        queryset = Item.objects.all()
        if not self.request.user.is_staff:
            queryset = queryset.filter(status='active')
        filter_params = {
            'location': ('location__name__icontains', None),
            'category': ('categories__id', None),
            'seller': ('seller__id', None),
            'price__lte': ('buy_price__lte', None),
            'price__gte': ('buy_price__gte', None),
            'price_current__lte': ('current_bid__lte', None),
            'price_current__gte': ('current_bid__gte', None),
            'country': ('country', None)
        }
        filters = {}
        for param, (field, default) in filter_params.items():
            value = self.request.query_params.get(param, default)
            if value is not None:
                try:
                    if param.startswith('price'):
                        value = float(value) 
                    filters[field] = value
                except ValueError:
                    continue
        return queryset.filter(**filters) if filters else queryset
    
    def get_permissions(self):
        if self.action == 'create':
            self.permission_classes = [permissions.IsAuthenticated]
        elif self.action in ['update', 'partial_update']:
            self.permission_classes = [permissions.IsAuthenticated, IsItemOwnerOrReadOnly]
        elif self.action == 'destroy':
            self.permission_classes = [IsItemOwnerOrReadOnly]
        else:
            self.permission_classes = [permissions.AllowAny]
        return [permission() for permission in self.permission_classes]
    
    def list(self, request, *args, **kwargs):
        user = request.user
        recommended = (request.query_params.get('ordering', '').lower() == 'recommended')
        if recommended and not user.is_anonymous:
            items = generate_recommendations(user)
        else:
            items = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(items)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(items, many=True)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        if response.status_code == 200:
            instance = self.get_object()
            self.record_visit(request.user, instance)
        return response

    def update(self, request, pk=None, partial=False):
        try:
            instance = self.get_object()
        except Item.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        self.check_edit_delete_validity(instance)
        data = request.data.copy()
        address = data.pop('address', None)
        latitude = data.pop('latitude', None) 
        longitude = data.pop('longitude', None) 
        if address:
            if latitude and longitude:
                location_obj, _ = Location.objects.get_or_create(
                    address=address[0], latitude=latitude[0], longitude=longitude[0]
                )
            else:
                location_obj, _ = Location.objects.get_or_create(address=address[0])
            data['location'] = location_obj.pk
        else:
            if latitude and longitude:
                instance_address = instance.location.address
                location_obj, _ = Location.objects.get_or_create(
                    address=instance_address, latitude=float(latitude[0]), longitude=(longitude[0])
                )
                data['location'] = location_obj.pk
        data.pop('additional_images', None)
        delete_images_id = data.pop('delete_images', None)
        if delete_images_id:
            ItemImage.objects.filter(id__in=delete_images_id).delete()
        serializer = self.get_serializer(
            instance, data=data, partial=partial,
            context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer = self.get_serializer(instance)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def ending_soon(self, request):
        now = timezone.now()
        tomorrow = now + timezone.timedelta(days=1)
        ending_soon = self.get_queryset().filter(
            ends__lte=tomorrow,
            ends__gte=now,
        )
        serializer = self.get_serializer(ending_soon, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def publish(self, pk, request):
        item = self.get_object()
        try:
            user = request.user.seller
        except Seller.DoesNotExist:
            return Response({'error': 'User has no seller profile'},
                            status=status.HTTP_404_NOT_FOUND)
        if not (user.is_staff or user.is_superuser) and user.seller != item.seller:
            return Response({'error': 'Not authorised to access item.'},
                            status=status.HTTP_401_UNAUTHORIZED)
        if item.status != 'draft':
            return Response({'error': 'only draft items can be published'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            item.publish()
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        serializer = ItemSerializer(item)
        return Response(serializer.data, status=status.HTTP_200_OK)

class BidViewSet(viewsets.ModelViewSet):
    queryset = Bid.objects.all()
    permission_classes = [IsBidOwner]
    authentication_classes = [JWTAuthentication]

    def get_serializer_class(self):
        if self.action in ['create', 'update']:
            return CreateBidSerializer
        else:
            return BidSerializer
        return super().get_serializer_class()

    def get_queryset(self):
        queryset = self.queryset
        if self.request.user.is_staff:
            return queryset
        subquery1 = queryset.none()
        subquery2 = queryset.none()
        my_bids = self.request.query_params.get('my_bids', True)
        my_items = self.request.query_params.get('my_items', False)
        if my_bids:
            try:
                bidder = Bidder.objects.get(userID=self.request.user)
                subquery1 = queryset.filter(bidder=bidder)
            except Bidder.DoesNotExist:
                subquery1 = queryset.none()
        if my_items:
            try:
                seller = Seller.objects.get(userID=self.request.user)
                items = Item.objects.filter(seller__userID=self.request.user).prefetch_related('bids')
                subquery2 = queryset.filter(item__in=items)
                return (subquery1 | subquery2).distinct()
            except:
                subquery2 = queryset.none()
        queryset = (subquery1 | subquery2).distinct()
        if not queryset.exists():
            return queryset
        item_id = self.request.query_params.get('item', None)
        if item_id:
            queryset = queryset.filter(item__id=item_id)
        return queryset
    
    def create(self, request):
        serializer = self.get_serializer_class()
        try:
            item = self.request.data.get('item')
        except:
            return Response(
                {'error': 'A valid item ID is required to place a bid.'}
            )
        try:
            item = Item.objects.get(id=item)
        except Item.DoesNotExist:
            return Response(
                {'error': 'Item does not exist.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        if item.status != 'active':
            return Response(
                {'error': 'Cannot place a bid on an item that is not active.'},
                status=status.HTTP_400_BAD_REQUEST,
            )   
        if item.ends < timezone.now():
            item.check_and_update_status()
            return Response(
                {'error':'Auction has ended.'},           
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            bidder = Bidder.objects.get(userID=self.request.user)
        except Bidder.DoesNotExist:
            return Response(
                {'error': 'You must have a bidder profile to place a bid.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        bid_amount = self.request.data.get('amount')
        if not bid_amount:
            return Response(
                {'error': 'Bid amount is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            bid_amount = float(bid_amount)
        except (ValueError, TypeError):
            return Response(
                {'error': 'Invalid bid amount.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if bid_amount <= item.current_bid:
            return Response(
                {'error': 'Bid amount must be greater than the current bid.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        bid_data = {
            'item': item.id,
            'bidder': bidder.id,
            'amount': bid_amount
        }
        print(bid_data)
        bought = False
        if item.buy_price and item.buy_price <= bid_amount:
            bid_amount = item.buy_price
            bought = True
        print(serializer)
        bid_serializer = serializer(data=bid_data)
        if bid_serializer.is_valid():
            bid_serializer.save()
            item.current_bid = bid_amount
            item.number_of_bids += 1
            item.save()
            if bought == True:
                item.close()
            return Response(bid_serializer.data, status=status.HTTP_201_CREATED)
        return Response(
            bid_serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )
    
class BidderViewSet(viewsets.ModelViewSet):
    queryset = Bidder.objects.all()
    serializer_class = BidderSerializer
    permission_classes = [BidderPerms]
    authentication_classes = [JWTAuthentication]

    def get_queryset(self):
        queryset = self.queryset
        location_param = self.request.query_params.get('location', None)
        le_param = self.request.query_params.get('rating__le', None)
        ge_param = self.request.query_params.get('rating__ge', None)
        if location_param:
            queryset.filter(location=location_param)
        if le_param:
            try:
                le_param = float(le_param)
                if le_param >= 0 and le_param <= 5:
                    queryset.filter(avg_rating__lte=le_param)
            except ValueError:
                pass
        if ge_param:
            try:
                ge_param = float(ge_param)
                if ge_param >=0 and ge_param <= 5:
                    queryset.filter(avg_rating__lte=le_param)
            except ValueError:
                pass
        return queryset

    def perform_create(self, serializer):
        serializer.save(userID=self.request.user)

    @action(detail=True, methods=['get'], serializer_class=BidSerializer)
    def bids(self, pk, request):
        bidder = self.get_object()
        if request.user != bidder.userID:
            raise PermissionError('Only the onwer of the profile is allowed to view its\' bids')
        serializer = self.serializer_class(bidder.bids.filter(item__status='active'), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class SellerViewSet(viewsets.ModelViewSet):
    queryset = Seller.objects.all()
    serializer_class = SellerSerializer
    permission_classes = [permissions.AllowAny]
    permission_classes = [SellerPerms]
    authentication_classes = [JWTAuthentication]

    def get_queryset(self):
        queryset = self.queryset
        le_param = self.request.query_params.get('rating__le', None)
        ge_param = self.request.query_params.get('rating__ge', None)
        if le_param:
            try:
                le_param = float(le_param)
                if le_param >= 0 and le_param <= 5:
                    queryset.filter(avg_rating__lte=le_param)
            except ValueError:
                pass
        if ge_param:
            try:
                ge_param = float(ge_param)
                if ge_param >=0 and ge_param <= 5:
                    queryset.filter(avg_rating__lte=le_param)
            except ValueError:
                pass
        return queryset
        
    def perform_create(self, serializer):
        serializer.save(userID=self.request.user)

    @action(
            detail=False,
            methods=['get'],
            serializer_class=ItemDetailSerializer,
            )
    def my_items(self, request):
        seller = self.request.user.seller_id
        if request.user != seller.userID:
            raise PermissionDenied('Only the onwer of the profile is allowed to view its\' items')
        status_param = self.request.query_params.get('status')
        if status_param == 'active':
            queryset = seller.items.filter(status=status_param).order_by('ends')
        else:
            queryset = seller.items.all().order_by('ends')
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    authentication_classes = [JWTAuthentication]

    def perform_create(self, serializer):
        serializer.save()

class SellerRatingsViewSet(viewsets.ModelViewSet):
    queryset = SellerRating.objects.all()
    serializer_class = SellerRatingSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    authentication_classes = [JWTAuthentication]
    
    @action(detail=False, methods=['get'], url_path='received')
    def received(self, request):
        seller = request.query_params.get('seller', request.user.seller)
        queryset = self.queryset.filter(seller=seller)
        serializer = self.serializer_class(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
        
    @action(detail=False, methods=['get'], url_path='given')
    def given(self, request):
        user_id = request.query_params.get('user', request.user)
        queryset = self.queryset.filter(reviewer=user_id)
        serializer = self.serializer_class(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    def perform_create(self, serializer):
        user = self.request.user
        rating = self.request.data.get('rating')
        seller = self.request.data.get('seller')
        if not seller:
            raise ValidationError('Seller ID is required to create a rating.')
        try:
            seller = Seller.objects.get(id=seller)
            seller.add_rating(rating)
        except Seller.DoesNotExist:
            raise ValidationError('Seller does not exist.')
        serializer.save(reviewer=self.request.user, seller=seller)
        def perform_update(self, serializer):
            new_rating = self.request.data.get('rating')
            old_rating = serializer.instance.rating
            seller = serializer.instance.seller
            seller.update_rating(old_rating, new_rating)
            serializer.save()
        def perform_destroy(self, instance):
            old_rating = instance.rating
            seller = instance.seller
            seller.remove_rating(old_rating)
            instance.delete()

class BidderRatingsViewSet(viewsets.ModelViewSet):
    queryset = BidderRating.objects.all()
    serializer_class = BidderRatingSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    authentication_classes = [JWTAuthentication]
    
    @action(detail=False, methods=['get'], url_path='received')
    def received(self, request):
        bidder = request.query_params.get('bidder', request.user.seller)
        queryset = self.queryset.filter(bidder=bidder)
        serializer = self.serializer_class(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
        
    @action(detail=False, methods=['get'], url_path='given')
    def given(self, request):
        user_id = request.query_params.get('user', request.user)
        queryset = self.queryset.filter(reviewer=user_id)
        serializer = self.serializer_class(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    def perform_create(self, serializer):
        user = self.request.user
        rating = self.request.data.get('rating')
        bidder = self.request.data.get('bidder')
        if not bidder:
            raise ValidationError('Bidder ID is required to create a rating.')
        try:
            bidder = Bidder.objects.get(id=bidder)
            bidder.add_rating(rating)
        except Bidder.DoesNotExist:
            raise ValidationError('Bidder does not exist.')
        serializer.save(reviewer=self.request.user, bidder=bidder)

    def perform_update(self, serializer):
        new_rating = self.request.data.get('rating')
        old_rating = serializer.instance.rating
        bidder = serializer.instance.bidder
        bidder.update_rating(old_rating, new_rating)
        serializer.save()

    def perform_destroy(self, instance):
        old_rating = instance.rating
        bidder = instance.bidder
        bidder.remove_rating(old_rating)
        instance.delete()    
    
class WinningPairViewSet(viewsets.ModelViewSet):
    queryset = WinningPair.objects.all()
    serializer_class = WinningPairSerializer
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_queryset(self):
        try:
            seller = Seller.objects.get(userID=self.request.user)
            queryset = self.queryset.filter(item__seller=seller, deleted_by_seller=False)
        except Seller.DoesNotExist:
            queryset = self.queryset.none()
        try:
            bidder = Bidder.objects.get(userID=self.request.user)
            queryset = queryset | self.queryset.filter(winning_bidder=bidder, deleted_by_bidder=False)
        except Bidder.DoesNotExist:
            pass

        item_filter = self.request.query_params.get('item')
        bidder_filter = self.request.query_params.get('bidder')
        seller_filter = self.request.query_params.get('seller')
        item_status_filter = self.request.query_params.get('item_status')  
        wp_status_filter = self.request.query_params.get('status')  

        if item_filter:
            queryset = queryset.filter(item=item_filter)
        if bidder_filter:
            queryset = queryset.filter(winning_bidder=bidder_filter)
        if seller_filter:
            queryset = queryset.filter(item__seller=seller_filter)
        if item_status_filter:
            queryset = queryset.filter(item__status=item_status_filter)
        if wp_status_filter:
            queryset = queryset.filter(status=wp_status_filter)

        return queryset.distinct()

    @action(methods=["get"], detail=True, url_name="messages")
    def messages(self, pk, request):
        winning_pair = self.get_object()
        if (request.user != winning_pair.item.seller.userID and
        request.user != winning_pair.winning_bidder.userID and not
        request.user.is_staff):
            return Response(
                {'error': 'You are not allowed to view messages for this winning pair.'},
                status=status.HTTP_403_FORBIDDEN
            )
        messages = Message.objects.filter(winning_pair=winning_pair)
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'], url_path='rate')
    def create_rating(self, request, pk=None):

        winning_pair = self.get_object()
        reviewer = self.request.user
        rating_value = self.request.data.get('rating')
        
        # Validate rating value
        if not rating_value:
            return Response(
                {'error': 'Rating is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            rating_value = int(rating_value)
            if rating_value < 1 or rating_value > 5:
                raise ValueError()
        except (ValueError, TypeError):
            return Response(
                {'error': 'Rating must be an integer between 1 and 5'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        seller_user = winning_pair.item.seller.userID
        bidder_user = winning_pair.winning_bidder.userID

        if reviewer.id not in [seller_user.id, bidder_user.id]:
            return Response(
                {'error': 'You are not authorized to rate in this auction'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        if reviewer == bidder_user:
            # Bidder is rating the seller
            # Check if rating already exists
            if hasattr(winning_pair, 'seller_review'):
                return Response(
                    {'error': 'You have already rated this seller'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create seller rating
            seller_rating = SellerRating.objects.create(
                rating=rating_value,
                winning_pair=winning_pair
            )
            
            # Update seller's average rating
            seller = winning_pair.item.seller
            seller.add_rating(rating_value)
            
            serializer = SellerRatingSerializer(seller_rating, context={'request': request})
            return Response({
                'message': 'Seller rating created successfully',
                'rating': serializer.data
            }, status=status.HTTP_201_CREATED)
            
        elif reviewer == seller_user:
            # Seller is rating the bidder
            # Check if rating already exists
            if hasattr(winning_pair, 'bidder_review'):
                return Response(
                    {'error': 'You have already rated this bidder'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create bidder rating
            bidder_rating = BidderRating.objects.create(
                rating=rating_value,
                winning_pair=winning_pair
            )
            
            # Update bidder's average rating
            bidder = winning_pair.winning_bidder
            bidder.add_rating(rating_value)
            
            serializer = BidderRatingSerializer(bidder_rating, context={'request': request})
            return Response({
                'message': 'Bidder rating created successfully',
                'rating': serializer.data
            }, status=status.HTTP_201_CREATED)
        
    def perform_destroy(self, instance):
        user = self.request.user

        if user == instance.item.seller.userID:
            instance.deleted_by_seller = True
        elif user == instance.winning_bidder.userID:
            instance.deleted_by_bidder = True
        else:
            raise PermissionDenied("You are not allowed to delete this conversation.")

        if instance.deleted_by_seller and instance.deleted_by_bidder:
            instance.deactivate()
        else:
            instance.save(update_fields=['deleted_by_seller', 'deleted_by_bidder'])

class ItemImageViewSet(viewsets.ModelViewSet):
    serializer_class = ItemImageSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        item_id = self.kwargs.get('item_pk')
        if item_id:
            return ItemImage.objects.filter(item_id=item_id)
        return ItemImage.objects.none()

    def perform_create(self, serializer):
        item_id = self.kwargs.get('item_pk')
        try:
            item = Item.objects.get(id=item_id)
            if item.seller.userID != self.request.user:
                raise permissions.PermissionDenied("You can only add images to your own items")
            serializer.save(item=item)
        except Item.DoesNotExist:
            raise ValidationError("Item not found")

    def perform_update(self, serializer):
        image = self.get_object()
        if image.item.seller.userID != self.request.user:
            raise permissions.PermissionDenied("You can only modify images of your own items")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.item.seller.userID != self.request.user:
            raise permissions.PermissionDenied("You can only delete images of your own items")
        instance.delete()

class MessageViewset(viewsets.ModelViewSet):
    queryset = Message.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_serializer_class(self):
        if self.action == 'create':
            return CreateMessageSerializer
        return MessageSerializer
    
    def get_queryset(self):
        queryset = self.queryset
        if not self.request.user.is_staff:
            queryset = self.queryset.filter(
                Q(sender=self.request.user) | Q(recipient=self.request.user)
            )
        winning_pair_param = self.request.query_params.get('winning_pair', None)
        recipient_param = self.request.query_params.get('recipient', None)
        sender_param = self.request.query_params.get('sender', None)
        read_param = self.request.query_params.get('read', None)
        if read_param:
            if read_param.lower() == 'true':
                queryset = queryset.filter(read=True)
            elif read_param.lower() == 'false':
                queryset = queryset.filter(read=False)
            else:
                raise ValidationError('Invalid value for read parameter. Use "true" or "false".')
        if recipient_param:
            queryset = queryset.filter(recipient=recipient_param)
        if sender_param:
            queryset = queryset.filter(sender=sender_param)
        if winning_pair_param:
            queryset = queryset.filter(winning_pair=winning_pair_param)
        return queryset.distinct()
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.recipient == request.user and not instance.is_read:
            instance.is_read = True
            instance.save(update_fields=['is_read'])
        return super().retrieve(request, *args, **kwargs)

