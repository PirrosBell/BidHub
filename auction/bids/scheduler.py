import threading
import time
from django.utils import timezone
from django.conf import settings
import logging
from django.core.management import call_command
from django.core.management.base import CommandError
import io
import sys
from bids.models import Item

logger = logging.getLogger(__name__)
MINUTE = 60


class BackgroundScheduler:
    def __init__(self):
        self._timer_close = None
        self._timer_publish = None
        self._timer_recommendations = None
        self.is_running = False

    def _close_items(self):

        if not self.is_running:
            return
            
        current_time = timezone.now()
        logger.info(f"Closing items at: {current_time}")
        
        try:
            
            ended_items = Item.objects.filter(status='active', ends__lte=current_time)

            for item in ended_items:
                item.close()
            
            
        except Exception as e:
            logger.error(f"Error in close task: {e}")
        
        self._timer_close = threading.Timer(MINUTE, self._close_items)
        self._timer_close.daemon = True
        self._timer_close.start()

    def _publish_auctions(self):

        if not self.is_running:
            return
        
        current_time = timezone.now()
        logger.info(f"Publishing auctions at: {current_time}")

        try:
            items_toPublish = Item.objects.filter(status="pending", started__lte=current_time)

            for item in items_toPublish:
                item.publish()
                
        except Exception as e:
            logger.error(f"Error in publish task: {e}")
        
        self._timer_publish = threading.Timer(MINUTE, self._publish_auctions)
        self._timer_publish.daemon = True
        self._timer_publish.start()



    def _generate_recommendations(self):

        if not self.is_running:
            return
            
        current_time = timezone.now()
        logger.info(f"Generating recommendations {current_time}")
        
        try:
            call_command('generate_recommendations')
            
        except Exception as e:
            logger.error(f"Error when generating recommendations: {e}")
        
        self._timer_recommendations = threading.Timer(60 * MINUTE, self._generate_recommendations)
        self._timer_recommendations.daemon = True
        self._timer_recommendations.start()

    def start(self):
        if not self.is_running:
            self.is_running = True
            logger.info("Starting background scheduler...")
            
            # Start close task
            self._timer_close = threading.Timer(MINUTE, self._close_items)
            self._timer_close.daemon = True
            self._timer_close.start()

            # Start publish task
            self._timer_publish = threading.Timer(MINUTE, self._publish_auctions)
            self._timer_publish.daemon = True
            self._timer_publish.start()
            
            # Start hour task
            self._timer_recommendations = threading.Timer(60 * MINUTE, self._generate_recommendations)
            self._timer_recommendations.daemon = True
            self._timer_recommendations.start()
            
            print("Background scheduler started successfully!")

    def stop(self):
        self.is_running = False
        if self._timer_close:
            self._timer_close.cancel()
        if self._timer_recommendations:
            self._timer_recommendations.cancel()
        if self._timer_publish:
            self._timer_publish.cancel()
        logger.info("Background scheduler stopped")

scheduler = BackgroundScheduler()