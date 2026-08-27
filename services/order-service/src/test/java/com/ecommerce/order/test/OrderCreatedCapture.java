package com.ecommerce.order.test;

import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Test-only capture of order.created so the integration test can assert the
 * saga's first hop actually hit the broker (not just that the DB row exists).
 */
@Component
public class OrderCreatedCapture {

    public static final BlockingQueue<ConsumerRecord<String, String>> RECORDS =
            new LinkedBlockingQueue<>();

    @KafkaListener(groupId = "test-order-created-capture", topics = "order.created")
    public void capture(ConsumerRecord<String, String> record) {
        RECORDS.add(record);
    }
}
