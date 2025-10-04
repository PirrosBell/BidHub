from django.utils import timezone
from rest_framework import serializers
from authentication.models import UserProfile
from bids.models import (Bid, Bidder, Location, Item, Seller, Category,
                         SellerRating, BidderRating, WinningPair, Message, ItemImage)
from authentication.serializers import (UserSerializer)
from django_countries.fields import CountryField
from django_countries import countries
from django.conf import settings

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = [
            'id',
            'name',
        ]
        read_only_fields = ['id']

class LocationSerializer(serializers.ModelSerializer):

    class Meta:
        model = Location
        fields = [
            'id',
            'address',
            'latitude',
            'longitude',
        ]
        read_only_fields = ['id']



class SellerSerializer(serializers.ModelSerializer):


    user_id = serializers.IntegerField(source='userID.id', read_only=True)
    username = serializers.CharField(source='userID.username', read_only=True)
    profile = serializers.SerializerMethodField()
    country = serializers.SerializerMethodField()

    class Meta:
        model = Seller
        fields = [
            'id',
            'user_id',
            'username',
            'avg_rating',
            'rating_count',
            'profile',
            'country',
        ]
        read_only_fields = ['id', 'userID', 'avg_rating', 'rating_count']

    def get_profile(self, obj):
        request = self.context.get('request') if hasattr(self, 'context') else None
        try:
            profile = obj.userID.profile
        except UserProfile.DoesNotExist:
            profile = None
        # Determine avatar URL (actual image or default)
        if profile and getattr(profile, 'profile_image', None) and request:
            try:
                avatar_url = request.build_absolute_uri(profile.profile_image.url)
            except Exception:
                avatar_url = None
        else:
            avatar_url = None
            if request:
                default_avatar = f"{settings.MEDIA_URL}avatar-default-user-profile-icon-social-media-vector-57234208.jpg"
                avatar_url = request.build_absolute_uri(default_avatar)
        return {
            'profile_image_url': avatar_url,
            'bio': getattr(profile, 'bio', '') if profile else '',
        }

    def get_country(self, obj):
        # Return seller's country using the related bidder profile (created at registration)
        try:
            bidder = obj.userID.bidder_id
            country = getattr(bidder, 'country', None)
            # country can be a Country object; return its name for display
            return getattr(country, 'name', str(country)) if country else None
        except Exception:
            return None

class BidderSerializer(serializers.ModelSerializer):

    user_id = serializers.IntegerField(source='userID.id', read_only=True)
    username = serializers.CharField(source='userID.username', read_only=True)

    class Meta:
        model = Bidder
        fields = [
            'id',
            'user_id',
            'location',
            'country',
            'avg_rating',
            'rating_count',
            'username', 
        ]
        read_only_fields = ['id', 'userID', 'avg_rating', 'rating_count']

    
    def validate_location(self, value):
        if value.latitude is not None or value.longitude is not None:
            raise serializers.ValidationError("Bidder location should not have latitude and longitude.")
        return value

class BidSerializer(serializers.ModelSerializer):
    bidder = BidderSerializer()

    class Meta:
        model = Bid
        fields = [
            'id',
            'item',
            'bidder',
            'time',
            'amount',
        ]
        read_only_fields = ['time']

class CreateBidSerializer(serializers.ModelSerializer):
    

    class Meta:
        model = Bid
        fields = [
            'item',
            'bidder',
            'amount',
        ]

class ItemImageSerializer(serializers.ModelSerializer):
    class Meta():
        model = ItemImage
        fields = ['id', 'image', 'alt_text', 'order', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_at']

class ItemListSerializer(serializers.ModelSerializer):
   
    main_image_url = serializers.SerializerMethodField()

    categories = CategorySerializer(many=True)
    seller = SellerSerializer()
    location = LocationSerializer()
    country = CountryField()

    class Meta:
        model = Item
        fields = [
            'id',
            'name',
            'categories',
            'buy_price',
            'current_bid',
            'country',
            'location',
            'ends',
            'seller',
            'status',
            'main_image',
            'first_bid',
            'main_image_url',
        ]
        read_only_fields = fields

    def get_main_image_url(self, obj):
        request = self.context.get('request')
        if not request:
            return None
        try:
            if obj.main_image:
                return request.build_absolute_uri(obj.main_image.url)
        except Exception:
            pass
        # Fallback to default filename in MEDIA_ROOT
        default_filename = '1222945_stock-photo-generic-toothpaste.jpg'
        return request.build_absolute_uri(f"{settings.MEDIA_URL}{default_filename}")

class ItemDetailSerializer(ItemListSerializer):

    additional_images = ItemImageSerializer(many=True, read_only=True)

    class Meta(ItemListSerializer.Meta):
        fields = ItemListSerializer.Meta.fields + [
            'description',
            'number_of_bids',
            'additional_images',
            'started',
        ]

class ItemCreateSerializer(serializers.ModelSerializer):
    country = CountryField()
    publish_immediately = serializers.BooleanField(write_only=True, default=False)
    uploaded_images = serializers.ListField(
        child=serializers.ImageField(),
        write_only=True,
        required=False,
        help_text="Additional images for the item"
    )

    address = serializers.CharField(write_only=True)
    latitude = serializers.FloatField(write_only=True, required=False, 
        min_value=-90, max_value=90)
    longitude = serializers.FloatField(write_only=True, required=False,
        min_value=-180, max_value=180)

    categories = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=True,
        help_text="List of category names. New categories will be created if they don't exist."
    )

    class Meta:
        model = Item
        fields = [
            'id',  
            'name',
            'description',
            'categories',
            'buy_price',
            'first_bid',
            'country',
            'address',
            'longitude',
            'latitude',
            'started',
            'ends',
            'main_image',
            'uploaded_images',
            'publish_immediately',
        ]
        read_only_fields = ['id']  
        extra_kwargs = {
            'name': {'required': True},
            'description': {'required': True},
            'first_bid': {'required': True},
            'buy_price': {'required': False},
            'ends': {'required': True},
            'country': {'required': True},
            'main_image': {'required': False},
            'address': {'required': True},
        }

    def validate_ends(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError("The end date is not valid, it has passed.")
        return value


    def validate_started(self, value):
        if value and value <= timezone.now():
            raise serializers.ValidationError("Start date must be in the future")
        return value

    def validate(self, data):
        if 'started' not in data and data.get('publish_immediately'):
            pass
        elif 'started' in data and not data.get('publish_immediately'):
            if data['started'] <= timezone.now():
                raise serializers.ValidationError({
                    "started": "Start date must be in the future"
                })
            
            if data['started'] >= data['ends']:
                raise serializers.ValidationError({
                    "started": "Start date must be after end date."
                })

        if ('latitude' in data) != ('longitude' in data):
            raise serializers.ValidationError({
                "location": "Both latitude and longitude must be provided together or not at all"
            })

        if not data.get('categories', []):
            raise serializers.ValidationError({
                "categories": "At least one category must be provided"
            })
        
        fb = data.get('first_bid', None)
        bp = data.get('buy_price', None)

        if bp < fb:
            raise serializers.ValidationError({
                "buy_price": "Buy price must be higher than first bid"
            })

        return data

    def create(self, validated_data):
        uploaded_images = validated_data.pop('uploaded_images', [])
        publish_immediately = validated_data.pop('publish_immediately', False)
        categories = validated_data.pop('categories', [])
        
        address = validated_data.pop('address')
        latitude = validated_data.pop('latitude', None)
        longitude = validated_data.pop('longitude', None)
        
        location, created_location = Location.objects.get_or_create(
            address=address,
            latitude=latitude,
            longitude=longitude,
        )
        location.save()
        
        categories_tocreate = []
        for name in categories:
            category, _ = Category.objects.get_or_create(name=name.strip())
            category.save()
            categories_tocreate.append(category)
        
        validated_data['current_bid'] = validated_data.get('first_bid')
        validated_data['number_of_bids'] = 0
        validated_data['status'] = 'pending'
        validated_data['location'] = location

        item = Item.objects.create(**validated_data)
        
        item.categories.set(categories_tocreate)

        for index, image in enumerate(uploaded_images):
            ItemImage.objects.create(
                item=item,
                image=image,
                order=index
            )

        if publish_immediately:
            try:
                item.publish()
            except serializers.ValidationError as e:
                if created_location:
                    location.delete()  
                item.delete()
                raise e
        
        item.save()
        return item

class OwnerItemDetailSerializer(ItemDetailSerializer):

    bids = BidSerializer(many=True, read_only=True)
    country = CountryField()

    class Meta(ItemDetailSerializer.Meta):
        fields = ItemDetailSerializer.Meta.fields + [
            'bids',
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if (self.instance and self.instance.status == 'active'
        and self.instance.number_of_bids > 0):
            locked_fields = ['first_bid', 'ends', 'categories', 'buy_price']
            for field in locked_fields:
                if field in self.fields:
                    self.fields[field].read_only = True

class OwnerItemUpdateSerializer(serializers.ModelSerializer):

    country = CountryField()
    additional_images = ItemImageSerializer(many=True)
    publish_immediately = serializers.BooleanField()
    class Meta:
        model = Item
        fields = [
            'name',
            'description',
            'categories',
            'buy_price',
            'first_bid',
            'country',
            'location',
            'started',
            'ends',
            'main_image',
            'first_bid',
            'number_of_bids',
            'status',
            'additional_images',
            'publish_immediately'
        ]
        read_only_fields = ['first_bid', 'number_of_bids', 'status']

    def validate(self, data):
        if self.instance.status == 'pending':
            pass
        elif self.instance.status == 'active':
            allowed = ['description', 'main_image']
            for field in data.keys():
                if field not in allowed:
                    raise serializers.ValidationError({field: "You cannot change this field while the item is active."})
        else:
            raise serializers.ValidationError("You cannot update a non-active item.")

        if 'ends' in data:
            if data['ends'] <= timezone.now():
                raise serializers.ValidationError({
                    "ends": "End date must be in the future",
                })

        return data
    def create(self, validated_data):
        item = super().create(validated_data)
        request = self.context.get('request')
        if request and hasattr(request, 'FILES'):
            additional_images = request.FILES.getlist('additional_images')
            for order, image_file in enumerate(additional_images):
                ItemImage.objects.create(
                    item=item,
                    image=image_file,
                    order=order
                )

        return item

    def update(self, instance: Item, validated_data):
        publish = validated_data.pop("publish_immediately", False)            
        instance = super().update(instance, validated_data)
        
        if publish:
            instance.publish()
        
        request = self.context.get('request')
        if request and hasattr(request, 'FILES'):
            additional_images = request.FILES.getlist('additional_images')
            
            for order, image_file in enumerate(additional_images):
                ItemImage.objects.create(
                    item=instance,
                    image=image_file,
                    order=order
                )
        
        return instance

    def validate(self, attrs):

        if not (self.instance.status == 'draft' or self.instance.status == 'pending' ) and (
        not (self.instance.status == 'active' and self.instance.number_of_bids == 0)):
            raise serializers.ValidationError(
                'You cannot edit this auction anymore'
            )


        ends = attrs.get('ends', self.instance.ends)
        started = attrs.get('started', self.instance.started)

        if ends <= started:
            raise serializers.ValidationError(
                'Invalid end or starting time: end time must be after the starting time'
            )

        fb = attrs.get('first_bid', self.instance.first_bid)
        bp = attrs.get('buy_price', self.instance.buy_price)

        if bp != None and fb != None and bp < fb:
            raise serializers.ValidationError(
                'Invalid buy_price or first_bid: first bid needs to be lower or equal to buy price'
            )    
    
        return attrs


    def validate_ends(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError("The end date is not valid, it has passed.")
        
        return value

    def validate_categories(self, value):
        if not value:
            raise serializers.ValidationError("At least one category must be selected.")
        return value
    
    # def validate_location(self, value):
    #     if value.latitude is None or value.longitude is None:
    #         raise serializers.ValidationError("Item location must have latitude and longitude.")
    #     return value

class AdminItemSerializer(serializers.ModelSerializer):

    additional_images = ItemImageSerializer(many=True, read_only=True)

    class Meta:
        model = Item
        fields = '__all__'


class SellerRatingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SellerRating
        fields = [
            'id',
            'rating',
            'winning_pair',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'winning_pair']

class BidderRatingSerializer(serializers.ModelSerializer):

    class Meta:
        model = BidderRating
        fields = [
            'id',
            'rating',
            'winning_pair',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'winning_pair']

class WinningPairSerializer(serializers.ModelSerializer):

    item = ItemListSerializer(read_only=True)
    winning_bidder = BidderSerializer(read_only=True)
    seller = SellerSerializer(source='item.seller', read_only=True)

    class Meta:
        model = WinningPair
        fields = [
            'id',
            'item',
            'winning_bidder',
            'created_at',
            'seller',
        ]
        read_only_fields = ['id', 'item', 'winning_bidder', 'created_at', 'seller']

    def validate(self,data):
        if data['item'].status != 'sold':
            raise serializers.ValidationError("The item must be sold to create a winning pair.")
        return data
    
class CreateMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = [
            'id',
            'winning_pair',
            'sender',
            'recipient',
            'content',
            'sent_at',
            'is_read',
        ]
        read_only_fields = ['id', 'sent_at', 'is_read']

    def validate(self, data):
        wp = data['winning_pair']
        allowed_users = {wp.winning_bidder.userID, wp.item.seller.userID}
        if data['sender'] not in allowed_users:
            raise serializers.ValidationError("The sender must be part of the winning pair.")
        if data['recipient'] not in allowed_users:
            raise serializers.ValidationError("The recipient must be part of the winning pair.")
        if data['sender'] == data['recipient']:
            raise serializers.ValidationError("Sender and recipient cannot be the same user.")
        return data

class MessageSerializer(CreateMessageSerializer):
    winning_pair = WinningPairSerializer(read_only=True)
    sender = UserSerializer(read_only=True)
    recipient = UserSerializer(read_only=True)

