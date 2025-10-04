from rest_framework import serializers
from django.contrib.auth.models import User
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import UserProfile
from bids.models import Seller, Bidder, Location


class UserProfileSerializer(serializers.ModelSerializer):
    profile_image_url = serializers.SerializerMethodField()
    afm = serializers.CharField(required=False)
    country = serializers.SerializerMethodField()
    
    class Meta:
        model = UserProfile
        fields = ['profile_image', 'profile_image_url', 'bio', 'phone_number', 'date_of_birth', 'afm', 'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country']
    
    def get_country(self, obj):
        if obj.country:
            return {
                'code': obj.country.code,
                'name': obj.country.name
            }
        return None
    
    def get_profile_image_url(self, obj):
        request = self.context.get('request')
        if obj.profile_image and request:
            return request.build_absolute_uri(obj.profile_image.url)
        elif request:
            from django.conf import settings
            default_avatar_url = f"{settings.MEDIA_URL}avatar-default-user-profile-icon-social-media-vector-57234208.jpg"
            return request.build_absolute_uri(default_avatar_url)
        return None
    
    def validate_afm(self, value):
        if value in (None, ""):
            return value
        if not value.isdigit() or len(value) != 9:
            raise serializers.ValidationError("AFM (tax ID) must be exactly 9 digits.")
        return value
        

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)
    profile_image = serializers.ImageField(write_only=True, required=False)
    bio = serializers.CharField(write_only=True, required=False, max_length=500)
    phone_number = serializers.CharField(write_only=True, required=True, max_length=20)
    address_line1 = serializers.CharField(write_only=True, required=True, max_length=255)
    address_line2 = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=255)
    city = serializers.CharField(write_only=True, required=True, max_length=100)
    state = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=100)
    postal_code = serializers.CharField(write_only=True, required=True, max_length=20)
    country = serializers.CharField(write_only=True, required=True, max_length=2)
    date_of_birth = serializers.DateField(write_only=True, required=False)
    afm = serializers.CharField(write_only=True, required=True, min_length=9, max_length=9)
    
    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password_confirm', 'first_name', 'last_name',
                 'profile_image', 'bio', 'phone_number', 'date_of_birth', 'afm', 'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country')
        extra_kwargs = { 'email': {'required': True}, }
    
    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value
    
    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value
    
    def validate_country(self, value):
        from django_countries import countries
        valid_codes = {code for code, name in countries}
        if value not in valid_codes:
            raise serializers.ValidationError("Invalid country code.")
        return value
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError("Passwords don't match.")
        afm = attrs.get('afm')
        if not afm or not afm.isdigit() or len(afm) != 9:
            raise serializers.ValidationError({'afm': 'AFM (tax ID) must be exactly 9 digits.'})
        return attrs
    
    def create(self, validated_data):
        profile_image = validated_data.pop('profile_image', None)
        bio = validated_data.pop('bio', '')
        phone_number = validated_data.pop('phone_number')
        date_of_birth = validated_data.pop('date_of_birth', None)
        afm = validated_data.pop('afm')
        address_line1 = validated_data.pop('address_line1')
        address_line2 = validated_data.pop('address_line2', '')
        city = validated_data.pop('city')
        state = validated_data.pop('state', '')
        postal_code = validated_data.pop('postal_code')
        country = validated_data.pop('country')
        validated_data.pop('password_confirm')
        
        user = User.objects.create_user(**validated_data)
        user.is_active = False
        user.save(update_fields=['is_active'])
        
        profile = getattr(user, 'profile', None)
        if profile is None:
            profile = UserProfile.objects.create(user=user)
        if profile_image is not None:
            profile.profile_image = profile_image
        profile.bio = bio
        profile.phone_number = phone_number
        profile.date_of_birth = date_of_birth
        profile.afm = afm
        profile.address_line1 = address_line1
        profile.address_line2 = address_line2
        profile.city = city
        profile.state = state
        profile.postal_code = postal_code
        profile.country = country
        profile.save()

        Seller.objects.create(userID=user)
        location_obj, _ = Location.objects.get_or_create(address=f"{address_line1}{address_line2}")
        Bidder.objects.create(userID=user, country=country, location=location_obj)


        return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data['user_id'] = self.user.id
        data['username'] = self.user.username
        data['email'] = self.user.email
        return data


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(required=False)
    seller_id = serializers.PrimaryKeyRelatedField(read_only=True)
    bidder_id = serializers.PrimaryKeyRelatedField(read_only=True)
    password = serializers.CharField(write_only=True, required=False)
    current_password = serializers.CharField(write_only=True, required=False)
    is_active = serializers.BooleanField(read_only=True)
    is_staff = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = User
        fields = (
            'id', 'username', 'email', 'first_name', 'last_name', 'date_joined',
            'profile', 'seller_id', 'bidder_id', 'is_active', 'is_staff',
            'password', 'current_password'
        )
        read_only_fields = ('id', 'date_joined', 'username', 'seller_id', 'bidder_id', 'is_active', 'is_staff')
        extra_kwargs = {'email': {'required': False}, 'first_name': {'required': False}, 'last_name': {'required': False}, }

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', None)
        new_password = validated_data.pop('password', None)
        current_password = validated_data.pop('current_password', None)

        # Update basic user fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # Handle password change if requested
        if new_password is not None:
            if not current_password or not instance.check_password(current_password):
                raise serializers.ValidationError({'current_password': 'Current password is incorrect.'})
            if len(new_password) < 8:
                raise serializers.ValidationError({'password': 'Password must be at least 8 characters.'})
            instance.set_password(new_password)

        instance.save()

        # Nested profile update (partial)
        if profile_data is not None:
            profile = getattr(instance, 'profile', None)
            if profile is None:
                profile = UserProfile.objects.create(user=instance)
            allowed_fields = {'phone_number', 'bio', 'profile_image', 'date_of_birth', 'afm', 'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country'}
            for key, value in profile_data.items():
                if key in allowed_fields:
                    setattr(profile, key, value)
            profile.save()

        return instance


class AdminUserSerializer(serializers.ModelSerializer):
    """
    Admin serializer allowing limited write access to User and nested profile.
    """
    profile = UserProfileSerializer(required=False)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'is_active', 'is_staff', 'date_joined', 'profile')
        read_only_fields = ('id', 'username', 'date_joined')

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', None)
        # Update user fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update nested profile
        if profile_data is not None:
            afm = profile_data.get('afm')
            if afm is not None:
                if not afm.isdigit() or len(afm) != 9:
                    raise serializers.ValidationError({'profile': {'afm': 'AFM (tax ID) must be exactly 9 digits.'}})
            profile = getattr(instance, 'profile', None)
            if profile is None:
                profile = UserProfile.objects.create(user=instance)
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()
        return instance
