package ru.eva.envtest;

import java.util.Arrays;
import java.util.Collections;
import java.util.Random;
import static ru.eva.envtest.PetPlay.Act.*;

/** A short scene is three ordinary puppet actions played from the same mark. */
final class PetStories {
    static final long REST_MS=75000;
    enum Story {
        LEAF_CASE(FLASHLIGHT, "Кто тут шуршал без прописки?",
            LEAF, "Лист. А орал как целый куст.",
            CAMERA, "Фото места побега. Сам гад в кармане."),
        AIR_MAIL(CAMERA, "Сфоткаю жалобу. Вдруг съедят.",
            PLANE, "Авиапочта! Береги лоб, адресат.",
            BOW, "Почта доставлена. Жалобы — самолётом."),
        DUST_DIG(DUST, "Под пылью ещё один рабочий стол?",
            FLASHLIGHT, "О, самолёт. Допотопная салфетка.",
            PLANE, "Музей закрыт. Экспонат взлетел."),
        NIGHT_CLUB(FLASHLIGHT, "Кто басит у меня под тапком?",
            BROOM_GUITAR, "Басист нашёлся. Метлу на сцену!",
            SMOKE, "Антракт. Носок ушёл курить со мной."),
        AUDITION(DRIBBLE, "Снимаем рекламу мяча. Дубль раз.",
            BALANCE, "Это финт. Кто сказал «поскользнулась»?",
            CAMERA_REVIEW, "Вот этот кадр оставим. Где я ещё стою."),
        ASH_ALIBI(SMOKE, "Ты пепельницу опять унёс?",
            DUST, "Заметаю следы своей взрослой жизни.",
            LEAF, "Блин. Это лист. Я оправдана.");

        final PetPlay.Act[] actions;
        final String[] lines;
        Story(PetPlay.Act a,String first,PetPlay.Act b,String second,PetPlay.Act c,String third){
            actions=new PetPlay.Act[]{a,b,c};
            lines=new String[]{first,second,third};
        }
    }

    private final Random random;
    private final Story[] deck=Story.values();
    private int cursor=deck.length;
    private long nextAt;
    private int ordinaryPlays;
    private Story previous;
    Story active;
    int beat;

    PetStories(Random random){this.random=random;}

    boolean start(long now){
        if(active!=null)return false;
        if(ordinaryPlays>0){ordinaryPlays--;return false;}
        if(now<nextAt)return false;
        if(cursor==deck.length){
            Collections.shuffle(Arrays.asList(deck),random);
            if(deck[0]==previous){Story swap=deck[0];deck[0]=deck[1];deck[1]=swap;}
            cursor=0;
        }
        active=previous=deck[cursor++];
        beat=0;
        ordinaryPlays=2;
        nextAt=now+REST_MS;
        return true;
    }

    boolean advance(){
        if(active==null||beat+1==active.actions.length)return false;
        beat++;
        return true;
    }
    PetPlay.Act act(){return active.actions[beat];}
    String line(){return active.lines[beat];}
    void cancel(){active=null;beat=0;}

    int lineAt(){
        switch(act()){
            case PLANE:return act().release;
            case CAMERA:return 1500;
            case LEAF:return 1020;
            case SMOKE:return 1000;
            default:return 640;
        }
    }
}
